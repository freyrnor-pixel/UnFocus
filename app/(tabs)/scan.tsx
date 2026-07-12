/**
 * scan.tsx — receipt OCR scanner & QR import
 *
 * Captures or picks a receipt photo, runs ML Kit text recognition, and parses
 * lines into priced items (parseReceiptText lives in lib/receipt). The user picks
 * a store (or enters a custom store name), edits/deselects rows, overrides
 * categories, and confirms. Also hosts a QR scanner that imports shared
 * shopping/task payloads into the shared store.
 *
 * Connections:
 *   Imports → components/AppModal, components/HintCard, components/ScreenScaffold, components/Surface, components/PressableScale, constants/theme, lib/date, lib/i18n, lib/receipt, lib/share, lib/siteNav, store/useCatalogStore, store/useReceiptStore, store/useSharedStore, store/useShoppingStore, @expo/vector-icons (Ionicons), @react-navigation/material-top-tabs + @react-navigation/native (types only, for the swipeEnabled guard)
 *   Used by → Expo Router route "/scan" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx; reached from app/(tabs)/shopping.tsx's post-trip receipt pop-up (autoCapture) and app/budget.tsx header link
 *   Data    → confirmed items write to FOUR stores: useShoppingStore (shopping_items) + useReceiptStore.addReceipt (receipts) + useCatalogStore.recordPurchases (purchase_log, linked via receipt_id, + store_items); QR import writes useSharedStore (shared_shopping_items / shared_tasks); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - Decision 001 tier='site' ScreenScaffold (bottomNav={false} — the tabs pager renders
 *     BottomNav itself; ownBackground={false} — app/(tabs)/_layout.tsx renders one shared
 *     backdrop behind the whole pager instead) for idle/result/manual modes; the transient
 *     'scanning' mode is a bare centered SafeAreaView, same as before this screen moved
 *     under app/(tabs)/.
 *   - The old ScreenHeader right-slot "Budget" link is now an in-content top link on the idle screen
 *     (site-tier headers render Focus-mode on the right, so a header link can't live there — same
 *     in-content-toolbar precedent as meals.tsx).
 *   - QR scanner modal is FIXED DARK CAMERA CHROME (Decision 025): '#000' background + fixed white
 *     title/frame, theme-independent (Decision 006's light-first tokens don't fit a live viewfinder,
 *     and textInverse flips dark in dark themes). The colored Cancel link stays on `accent`.
 *   - Four screen modes via `mode` state: idle, scanning, result, manual.
 *   - OCR pipeline: takePhoto/pickImage → mode:scanning → processImage → TextRecognition.recognize →
 *     parseReceiptText → enrichItemsWithCategories → auto-transition to mode:result. On failure/empty → mode:manual.
 *   - Recognised items are ALWAYS reviewed (checkbox list) before adding; never auto-added.
 *   - addToList() (AP-06B) creates a receipt (date/store/total of selected items) via useReceiptStore
 *     BEFORE recordPurchases, then threads receipt.id into every recordPurchases entry so app/budget.tsx
 *     can total this month's spend. Requires a store picked first. Also fuzzy-matches each scanned name
 *     against Katalog shopping_items and raises that item's price if higher (only ever raises).
 *   - addManualItems() creates a receipt only when a price is entered with a store selected.
 *   - Both add paths create shopping_items rows with status='inWeeklyList' (not 'catalog').
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen has no
 *     per-screen focus-load.
 *   - **Pager-swipe guard:** this screen is one of the tabs pager's 5 co-mounted sites, so a
 *     horizontal swipe is always live over it. While mode==='scanning' (OCR in flight) or any
 *     overlay (QR modal, custom-store sheet, category picker) is open, an effect flips the
 *     pager's swipeEnabled off via navigation.setOptions so a stray swipe can't abandon that
 *     flow — reverted the instant the mode/overlay clears. Deliberately NOT a full route split
 *     (e.g. a pushed app/scan-camera.tsx): 'scanning' holds no live camera resource (the photo
 *     is already captured via ImagePicker by the time this mode renders — it's just the
 *     OCR-wait pulse animation), and the QR CameraView already lives inside a React Native
 *     Modal (its own native layer, unaffected by the pager underneath) — so there's no
 *     persistent-camera-in-a-hidden-pager-page risk to design around, only the UX risk this
 *     guard closes.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import type { MaterialTopTabNavigationProp } from '@react-navigation/material-top-tabs';
import type { ParamListBase } from '@react-navigation/native';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useSharedStore } from '@/store/useSharedStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useReceiptStore } from '@/store/useReceiptStore';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { formatKr } from '@/lib/money';
import HintCard from '@/components/HintCard';
import Surface from '@/components/Surface';
import ScreenScaffold from '@/components/ScreenScaffold';
import { goToSite } from '@/lib/siteNav';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';
import { decodeSharePayload } from '@/lib/share';
import { parseReceiptText, findFuzzyMatch, ParsedReceiptItem as ParsedItem } from '@/lib/receipt';
import { FontSize, Radius, Shadow, Spacing, rgba } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

// Fixed camera-chrome colours (Decision 025) — theme-independent, always white-on-black.
const QR_BG = '#000000';
const QR_FG = '#FFFFFF';
const QR_HINT = 'rgba(255,255,255,0.6)';

const NORWEGIAN_STORES = [
  'REMA 1000', 'Kiwi', 'Coop Extra', 'Coop Mega', 'Meny', 'Spar', 'Bunnpris', 'Joker', 'Prix',
];

const CATEGORIES = ['produce', 'dairy', 'meat', 'fish', 'bread', 'frozen', 'canned', 'dry', 'snacks', 'drinks', 'cleaning', 'personal', 'other'];

type ScreenMode = 'idle' | 'scanning' | 'result' | 'manual';

export default function ScanScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useNavigation<MaterialTopTabNavigationProp<ParamListBase>>();
  const { autoCapture } = useLocalSearchParams<{ autoCapture?: 'camera' | 'library' }>();
  const addShopping = useShoppingStore((s) => s.add);
  const updateShoppingItem = useShoppingStore((s) => s.update);
  const shoppingItems = useShoppingStore((s) => s.items);
  const recordPurchases = useCatalogStore((s) => s.recordPurchases);
  const catalogStoreItems = useCatalogStore((s) => s.items);
  const addReceipt = useReceiptStore((s) => s.addReceipt);
  const addSharedShopping = useSharedStore((s) => s.addSharedShopping);
  const addSharedTasks = useSharedStore((s) => s.addSharedTasks);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScreenMode>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [manualText, setManualText] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [customStoreVisible, setCustomStoreVisible] = useState(false);
  const [customStoreName, setCustomStoreName] = useState('');
  const [qrScanVisible, setQrScanVisible] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [categoryPickerIndex, setCategoryPickerIndex] = useState(-1);
  const manualInputRef = useRef<TextInput>(null);
  const customStoreRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const autoCaptureFired = useRef(false);

  // Shopping's post-trip receipt pop-up routes here with autoCapture to go straight into the
  // camera/library picker — guarded so a remount never re-fires the same auto-capture.
  useEffect(() => {
    if (autoCaptureFired.current || !autoCapture) return;
    autoCaptureFired.current = true;
    if (autoCapture === 'camera') takePhoto();
    else if (autoCapture === 'library') pickImage();
  }, [autoCapture]);

  // This screen is one of the pager's 5 co-mounted tabs (app/(tabs)/_layout.tsx). A stray
  // horizontal swipe mid-OCR or with an overlay sheet open would abandon that flow with no
  // way back to it (the pager just shows another tab) — briefly disable the pager's own
  // swipe for the duration instead. `scanning` has no camera hardware held open (the photo
  // is already captured via ImagePicker by this point; this mode is just the OCR wait
  // screen), so this is a UX guard, not a resource-safety one.
  useEffect(() => {
    const disableSwipe = mode === 'scanning' || qrScanVisible || customStoreVisible || categoryPickerVisible;
    navigation.setOptions({ swipeEnabled: !disableSwipe });
  }, [navigation, mode, qrScanVisible, customStoreVisible, categoryPickerVisible]);

  // Pulsing animation for scanning state.
  useEffect(() => {
    if (mode === 'scanning') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.14, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [mode, pulseAnim]);

  // Auto-focus manual input when entering manual mode.
  useEffect(() => {
    if (mode === 'manual') {
      setTimeout(() => manualInputRef.current?.focus(), 100);
    }
  }, [mode]);

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAppModal(t.permissionTitle, t.permissionBody);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setMode('scanning');
      setTimeout(() => processImage(uri), 100);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setMode('scanning');
      setTimeout(() => processImage(uri), 100);
    }
  }

  function enrichItemsWithCategories(items: ParsedItem[]): ParsedItem[] {
    const storeItemNames = catalogStoreItems.map((i) => i.name);
    return items.map((item) => {
      const match = findFuzzyMatch(item.name, storeItemNames);
      const category = match ? catalogStoreItems.find((i) => i.name === match)?.category : undefined;
      return { ...item, category };
    });
  }

  async function processImage(uri: string) {
    try {
      const result = await TextRecognition.recognize(uri);
      const items = parseReceiptText(result.text);
      if (items.length > 0) {
        const enrichedItems = enrichItemsWithCategories(items);
        setParsedItems(enrichedItems);
        await new Promise((resolve) => setTimeout(resolve, 1800));
        setMode('result');
      } else {
        handleOcrFailure();
      }
    } catch {
      handleOcrFailure();
    }
  }

  function handleOcrFailure() {
    setImageUri(null);
    setParsedItems([]);
    setMode('manual');
  }

  function toggleItem(i: number) {
    setParsedItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, selected: !item.selected } : item)));
  }

  function updateName(i: number, name: string) {
    setParsedItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, name } : item)));
  }

  function updateCategory(i: number, category: string) {
    setParsedItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, category } : item)));
  }

  function addManualItems() {
    const lines = manualText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    if (lines.length === 0) return;

    // A price only makes sense when there's exactly one item to attach it to.
    const price = lines.length === 1 ? parseFloat(manualPrice.replace(',', '.')) || 0 : 0;
    let receiptId: string | undefined;
    if (selectedStore && price > 0) {
      const receipt = addReceipt({ date: todayStr(), store: selectedStore, total: price, category: 'groceries' });
      receiptId = receipt.id;
      recordPurchases([{ name: lines[0], store: selectedStore, price, wasOnList: false }], receiptId);
    }

    lines.forEach((name, idx) => {
      addShopping({ name, amount: '1', unit: '', listType: 'weekly', store: selectedStore, price: idx === 0 ? price : 0, inventoryQty: 0, status: 'inWeeklyList' });
    });

    setManualText('');
    setManualPrice('');
    setImageUri(null);
    setParsedItems([]);
    setMode('idle');
    showAppModal(t.addedTitle, t.addedBody(lines.length), [{ text: t.ok }]);
  }

  function addToList() {
    if (!selectedStore) {
      showAppModal(t.selectStoreFirstTitle, t.selectStoreFirstBody);
      return;
    }
    const selected = parsedItems.filter((i) => i.selected);
    const existingNames = new Set(shoppingItems.map((i) => i.name.toLowerCase()));
    // Catalog items (status='catalog') that fuzzy-match a scanned name get their price
    // silently raised (never lowered), even when the scanned item isn't on the list.
    const catalogItems = shoppingItems.filter((i) => i.status === 'catalog');
    const catalogNames = catalogItems.map((i) => i.name);

    selected.forEach((item) => {
      const match = findFuzzyMatch(item.name, catalogNames);
      if (match) {
        const catalogItem = catalogItems.find((i) => i.name === match);
        if (catalogItem && item.price > catalogItem.price) {
          updateShoppingItem(catalogItem.id, { price: item.price });
        }
      }
      addShopping({ name: item.name, amount: '1', unit: '', listType: 'weekly', store: selectedStore, price: item.price, inventoryQty: 0, status: 'inWeeklyList' });
    });

    const receiptId = selected.length
      ? addReceipt({
          date: todayStr(),
          store: selectedStore,
          total: selected.reduce((sum, item) => sum + item.price, 0),
          category: 'groceries',
        }).id
      : undefined;

    recordPurchases(
      selected.map((item) => ({
        name: item.name,
        store: selectedStore,
        price: item.price,
        category: item.category,
        wasOnList: existingNames.has(item.name.toLowerCase()),
      })),
      receiptId
    );

    setManualText('');
    setImageUri(null);
    setParsedItems([]);
    setMode('idle');
    showAppModal(t.addedTitle, t.addedBody(selected.length), [{ text: t.ok }]);
  }

  async function openQrScanner() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        showAppModal(t.permissionTitle, t.permissionBody);
        return;
      }
    }
    setQrScanned(false);
    setQrScanVisible(true);
  }

  function handleQrScanned({ data }: { data: string }) {
    if (qrScanned) return;
    setQrScanned(true);
    const payload = decodeSharePayload(data);
    if (!payload || payload.k === 'p') {
      // Pairing QR codes ('p') aren't scanned from this screen — only shopping/task shares.
      showAppModal('', t.qrInvalid, [{ text: t.ok, onPress: () => setQrScanned(false) }]);
      return;
    }
    const sharedBy = payload.b || 'Unknown';
    if (payload.k === 's') {
      addSharedShopping(
        payload.i.map((item) => ({
          sourceItemId: null,
          name: item.n,
          amount: item.a,
          unit: item.u,
          direction: 'in' as const,
          sharedBy,
        }))
      );
      showAppModal(t.qrScanSuccess, t.qrScanSuccessBody(payload.i.length, 'shopping'), [
        { text: t.ok, onPress: () => { setQrScanVisible(false); goToSite(router, pathname, '/shared'); } },
      ]);
    } else {
      addSharedTasks(
        payload.i.map((item) => ({
          sourceTaskId: null,
          title: item.n,
          date: item.d,
          direction: 'in' as const,
          sharedBy,
        }))
      );
      showAppModal(t.qrScanSuccess, t.qrScanSuccessBody(payload.i.length, 'tasks'), [
        { text: t.ok, onPress: () => { setQrScanVisible(false); goToSite(router, pathname, '/shared'); } },
      ]);
    }
  }

  const selectedCount = parsedItems.filter((i) => i.selected).length;
  const totalPrice = parsedItems.filter((i) => i.selected).reduce((sum, item) => sum + item.price, 0);
  const manualLineCount = manualText.split('\n').filter((line) => line.trim().length > 0).length;

  function renderStoreSelector() {
    return (
      <View style={styles.storeSection}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.store.toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeScroll}>
          <View style={styles.storeRow}>
            {NORWEGIAN_STORES.map((store) => (
              <PressableScale
                key={store}
                style={[
                  styles.storeChip,
                  { borderWidth: 1, borderColor: theme.border },
                  selectedStore === store && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}
                onPress={() => setSelectedStore(selectedStore === store ? '' : store)}
                scaleTo={0.97}
              >
                <Text style={[styles.storeChipText, { color: theme.text }, selectedStore === store && { color: theme.accentInk }]}>
                  {store}
                </Text>
              </PressableScale>
            ))}
            <PressableScale
              style={[
                styles.storeChip,
                { borderWidth: 1, borderColor: theme.border },
                selectedStore && !NORWEGIAN_STORES.includes(selectedStore) && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
              onPress={() => setCustomStoreVisible(true)}
              scaleTo={0.97}
            >
              <Text style={[styles.storeChipText, { color: theme.text }, selectedStore && !NORWEGIAN_STORES.includes(selectedStore) && { color: theme.accentInk }]}>
                {selectedStore && !NORWEGIAN_STORES.includes(selectedStore) ? selectedStore : t.otherStore}
              </Text>
            </PressableScale>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Custom-store sheet + QR scanner modal — shared across idle/result/manual so they render once here.
  function renderOverlays() {
    return (
      <>
        {/* QR scanner modal — fixed dark camera chrome */}
        <Modal visible={qrScanVisible} animationType="slide" onRequestClose={() => setQrScanVisible(false)}>
          <View style={[styles.qrModal, { backgroundColor: QR_BG }]}>
            <SafeAreaView style={styles.qrSafeArea}>
              <View style={styles.qrHeader}>
                <PressableScale onPress={() => setQrScanVisible(false)} scaleTo={0.97}>
                  <Text style={[styles.backLink, { color: theme.accent }]}>{t.cancel}</Text>
                </PressableScale>
                <Text style={[styles.qrTitle, { color: QR_FG }]}>{t.qrScanMode}</Text>
                <View style={{ width: 60 }} />
              </View>
              <Text style={[styles.qrHint, { color: QR_HINT }]}>{t.qrScanInstructions}</Text>
              {qrScanVisible && (
                <CameraView
                  style={styles.qrCamera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleQrScanned}
                />
              )}
              <View style={styles.qrOverlay} pointerEvents="none">
                <View style={[styles.qrFrame, { borderColor: QR_FG }]} />
              </View>
            </SafeAreaView>
          </View>
        </Modal>

        {/* Custom store sheet */}
        <Modal visible={customStoreVisible} transparent animationType="slide" onRequestClose={() => setCustomStoreVisible(false)}>
          <Pressable style={styles.backdrop} onPress={() => setCustomStoreVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetKvWrapper}>
            <Surface surfaceContext="overlay" style={styles.manualSheet}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.surfaceMuted }]} />
              <Text style={[styles.sheetTitle, { color: theme.text }]}>{t.otherStore}</Text>
              <Text style={[styles.sheetLabel, { color: theme.textMuted }]}>{t.customStoreLabel}</Text>
              <TextInput
                ref={customStoreRef}
                style={[styles.sheetInput, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                placeholder={t.customStorePlaceholder}
                placeholderTextColor={theme.textMuted}
                value={customStoreName}
                onChangeText={setCustomStoreName}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (customStoreName.trim()) {
                    setSelectedStore(customStoreName.trim());
                    setCustomStoreName('');
                    setCustomStoreVisible(false);
                  }
                }}
                autoFocus
              />
              <View style={styles.sheetButtons}>
                <PressableScale style={[styles.sheetCancelBtn, { borderColor: theme.border }]} onPress={() => setCustomStoreVisible(false)} scaleTo={0.97}>
                  <Text style={[styles.sheetCancelText, { color: theme.textMuted }]}>{t.cancel}</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.sheetAddBtn, { backgroundColor: theme.accent }, !customStoreName.trim() && { opacity: 0.4 }]}
                  onPress={() => {
                    if (customStoreName.trim()) {
                      setSelectedStore(customStoreName.trim());
                      setCustomStoreName('');
                      setCustomStoreVisible(false);
                    }
                  }}
                  disabled={!customStoreName.trim()}
                  scaleTo={0.95}
                >
                  <Text style={[styles.sheetAddText, { color: theme.accentInk }]}>{t.ok}</Text>
                </PressableScale>
              </View>
            </Surface>
          </KeyboardAvoidingView>
        </Modal>
      </>
    );
  }

  // IDLE MODE — main scan screen
  if (mode === 'idle') {
    return (
      <>
        <ScreenScaffold title={t.scanReceipt} tier="site" bottomNav={false} ownBackground={false}>
          <View style={styles.content}>
            <PressableScale
              style={[styles.budgetPill, { backgroundColor: rgba(theme.featBudget, 0.16) }]}
              onPress={() => goToSite(router, pathname, '/budget')}
              hitSlop={6}
              scaleTo={0.97}
            >
              <Text style={[styles.budgetPillText, { color: theme.featBudget }]}>{t.budget.title}</Text>
            </PressableScale>

            <View style={[styles.tipBox, { backgroundColor: theme.goodSoft }]}>
              <Text style={[styles.tipText, { color: theme.text }]}>{t.scanHintBanner}</Text>
            </View>

            {/* Primary camera button */}
            <PressableScale
              style={[styles.primaryButton, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
              onPress={takePhoto}
              scaleTo={0.95}
            >
              <Ionicons name="camera-outline" size={46} color={theme.accentInk} />
              <Text style={[styles.primaryButtonText, { color: theme.accentInk }]}>{t.takePhoto}</Text>
            </PressableScale>

            {/* 2-column grid */}
            <View style={styles.gridRow}>
              <Surface style={styles.gridCard}>
                <PressableScale style={styles.gridCardInner} onPress={pickImage} scaleTo={0.97}>
                  <Ionicons name="images-outline" size={28} color={theme.accent} />
                  <Text style={[styles.gridCardText, { color: theme.text }]}>{t.chooseFromLibrary}</Text>
                </PressableScale>
              </Surface>
              <Surface style={styles.gridCard}>
                <PressableScale style={styles.gridCardInner} onPress={() => setMode('manual')} scaleTo={0.97}>
                  <Ionicons name="pencil-outline" size={28} color={theme.accent} />
                  <Text style={[styles.gridCardText, { color: theme.text }]}>{t.addManually}</Text>
                </PressableScale>
              </Surface>
            </View>

            {/* QR button */}
            <PressableScale
              style={[styles.qrButton, { backgroundColor: theme.goodSoft, borderColor: theme.good }]}
              onPress={openQrScanner}
              scaleTo={0.97}
            >
              <Ionicons name="qr-code-outline" size={26} color={theme.good} />
              <Text style={[styles.qrButtonText, { color: theme.good }]}>{t.scanQrCode}</Text>
            </PressableScale>

            <View style={{ height: 40 }} />
          </View>
        </ScreenScaffold>

        {renderOverlays()}
      </>
    );
  }

  // SCANNING MODE — pulsing animation
  if (mode === 'scanning') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <View style={styles.scanningContainer}>
          <Animated.View style={[styles.pulseCircle, { backgroundColor: theme.accentSoft, transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="camera-outline" size={42} color={theme.accent} />
          </Animated.View>
          <Text style={[styles.scanningTitle, { color: theme.text }]}>{t.analysingReceipt}</Text>
          <Text style={[styles.scanningSubtitle, { color: theme.textMuted }]}>{t.scanningSubtitle}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // RESULT MODE — parsed items with selection
  if (mode === 'result' && parsedItems.length > 0) {
    return (
      <>
        <ScreenScaffold title={t.foundOnReceipt} tier="site" bottomNav={false} ownBackground={false}>
          <View style={styles.content}>
            <HintCard text={t.itemsSelectedCount(selectedCount, parsedItems.length)} example="" />

            <Surface style={styles.itemsCard}>
              {parsedItems.map((item, i) => (
                <View key={i}>
                  <PressableScale style={[styles.itemRow, { borderBottomColor: theme.border }]} onPress={() => toggleItem(i)} scaleTo={0.97}>
                    <View style={[styles.checkbox, { borderColor: theme.accent }, item.selected && { backgroundColor: theme.accent }]}>
                      {item.selected && <Text style={[styles.checkMark, { color: theme.accentInk }]}>✓</Text>}
                    </View>
                    <TextInput
                      style={[styles.itemName, { color: theme.text }, !item.selected && { opacity: 0.42 }]}
                      value={item.name}
                      onChangeText={(v) => updateName(i, v)}
                    />
                    <Text style={[styles.itemQty, { color: theme.textMuted }, !item.selected && { opacity: 0.42 }]}>
                      1 stk
                    </Text>
                    <Text style={[styles.itemPrice, { color: theme.textMuted }, !item.selected && { opacity: 0.42 }]}>
                      {formatKr(item.price, 2)}
                    </Text>
                  </PressableScale>
                  <PressableScale
                    style={[styles.categoryChip, { backgroundColor: theme.surfaceMuted }]}
                    onPress={() => { setCategoryPickerIndex(i); setCategoryPickerVisible(true); }}
                    scaleTo={0.97}
                  >
                    <Text style={[styles.categoryChipText, { color: theme.textMuted }]}>{item.category ?? 'other'}</Text>
                  </PressableScale>
                </View>
              ))}

              <View style={[styles.totalRow, { borderTopColor: theme.border, borderTopWidth: 1 }]}>
                <Text style={[styles.totalText, { color: theme.textMuted }]}>{t.totalAmount(formatKr(totalPrice, 2))}</Text>
              </View>
            </Surface>

            <PressableScale style={[styles.confirmButton, { backgroundColor: theme.accent }]} onPress={addToList} scaleTo={0.95}>
              <Text style={[styles.confirmButtonText, { color: theme.accentInk }]}>{t.addToListButton(selectedCount)}</Text>
            </PressableScale>

            <PressableScale style={[styles.cancelButton, { borderColor: theme.border }]} onPress={() => {
              setMode('idle');
              setImageUri(null);
              setParsedItems([]);
            }} scaleTo={0.97}>
              <Text style={[styles.cancelButtonText, { color: theme.textMuted }]}>{t.cancel}</Text>
            </PressableScale>

            <View style={{ height: 40 }} />
          </View>
        </ScreenScaffold>

        {/* Category picker modal */}
        <Modal visible={categoryPickerVisible} transparent animationType="slide" onRequestClose={() => setCategoryPickerVisible(false)}>
          <Pressable style={styles.backdrop} onPress={() => setCategoryPickerVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetKvWrapper}>
            <Surface surfaceContext="overlay" style={styles.manualSheet}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.surfaceMuted }]} />
              <Text style={[styles.sheetTitle, { color: theme.text }]}>{t.recognisedItems}</Text>
              <ScrollView style={styles.categoryGrid} contentContainerStyle={styles.categoryGridContent}>
                {CATEGORIES.map((cat) => (
                  <PressableScale
                    key={cat}
                    style={[styles.categoryOption, { backgroundColor: parsedItems[categoryPickerIndex]?.category === cat ? theme.accent : theme.surfaceMuted }]}
                    onPress={() => {
                      updateCategory(categoryPickerIndex, cat);
                      setCategoryPickerVisible(false);
                    }}
                    scaleTo={0.97}
                  >
                    <Text style={[styles.categoryOptionText, { color: parsedItems[categoryPickerIndex]?.category === cat ? theme.accentInk : theme.text }]}>
                      {cat}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </Surface>
          </KeyboardAvoidingView>
        </Modal>

        {renderOverlays()}
      </>
    );
  }

  // MANUAL MODE — text input for items
  if (mode === 'manual') {
    return (
      <>
        <ScreenScaffold title={t.manualEntryTitle} tier="site" bottomNav={false} ownBackground={false}>
          <View style={styles.content}>
            <HintCard text={t.manualEntryHint} example="" />

            {renderStoreSelector()}

            <TextInput
              ref={manualInputRef}
              multiline
              numberOfLines={8}
              style={[styles.manualInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
              placeholder={t.manualEntryPlaceholder}
              placeholderTextColor={theme.textMuted}
              value={manualText}
              onChangeText={setManualText}
            />

            {manualLineCount === 1 && (
              <View>
                <Text style={[styles.sheetLabel, { color: theme.textMuted }]}>{t.estimertPrisLabel}</Text>
                <TextInput
                  style={[styles.sheetInput, { color: theme.text, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border }]}
                  placeholder="0.00"
                  placeholderTextColor={theme.textMuted}
                  value={manualPrice}
                  onChangeText={setManualPrice}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            )}

            <PressableScale
              style={[styles.confirmButton, { backgroundColor: theme.accent }, manualLineCount === 0 && { opacity: 0.5 }]}
              onPress={addManualItems}
              disabled={manualLineCount === 0}
              scaleTo={0.95}
            >
              <Text style={[styles.confirmButtonText, { color: theme.accentInk }]}>
                {t.addToListButton(manualLineCount)}
              </Text>
            </PressableScale>

            <PressableScale style={[styles.cancelButton, { borderColor: theme.border }]} onPress={() => {
              setMode('idle');
              setManualText('');
              setManualPrice('');
              setImageUri(null);
              setParsedItems([]);
            }} scaleTo={0.97}>
              <Text style={[styles.cancelButtonText, { color: theme.textMuted }]}>{t.cancel}</Text>
            </PressableScale>

            <View style={{ height: 40 }} />
          </View>
        </ScreenScaffold>

        {renderOverlays()}
      </>
    );
  }

  return null;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md },

  // IDLE MODE
  budgetPill: {
    alignSelf: 'flex-end',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  budgetPillText: { fontSize: FontSize.xs, fontWeight: '700' },
  backLink: { fontSize: FontSize.sm, fontWeight: '700' },
  tipBox: { borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
  tipText: { fontSize: FontSize.sm, lineHeight: 20 },

  storeSection: { gap: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.07 },
  storeScroll: {},
  storeRow: { flexDirection: 'row', gap: Spacing.sm },
  storeChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  storeChipText: { fontSize: FontSize.sm, fontWeight: '500' },

  primaryButton: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 11,
    elevation: 8,
  },
  primaryButtonText: { fontSize: FontSize.xl, fontWeight: '700' },

  gridRow: { flexDirection: 'row', gap: Spacing.sm },
  gridCard: {
    flex: 1,
    borderRadius: Radius.md,
  },
  gridCardInner: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  gridCardText: { fontSize: FontSize.sm, fontWeight: '600', textAlign: 'center' },

  qrButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
  },
  qrButtonText: { fontSize: FontSize.md, fontWeight: '700' },

  // SCANNING MODE
  scanningContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.xl },
  pulseCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningTitle: { fontSize: FontSize.lg, fontWeight: '600', textAlign: 'center' },
  scanningSubtitle: { fontSize: FontSize.sm, textAlign: 'center' },

  // RESULT MODE
  itemsCard: { borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontSize: FontSize.xs, fontWeight: '700' },
  itemName: { flex: 1, fontSize: FontSize.md, fontWeight: '500' },
  itemQty: { fontSize: FontSize.sm, minWidth: 40 },
  itemPrice: { fontSize: FontSize.sm, fontWeight: '600', minWidth: 44, textAlign: 'right' },
  totalRow: { paddingTop: Spacing.sm, paddingBottom: Spacing.sm, alignItems: 'flex-end' },
  totalText: { fontSize: FontSize.sm, fontWeight: '600' },

  categoryChip: {
    alignSelf: 'flex-start',
    marginLeft: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  categoryChipText: { fontSize: FontSize.xs, fontWeight: '500' },
  categoryGrid: { maxHeight: 280 },
  categoryGridContent: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingVertical: Spacing.sm },
  categoryOption: {
    width: '48%',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  categoryOptionText: { fontSize: FontSize.sm, fontWeight: '500', textAlign: 'center' },

  // BUTTONS
  confirmButton: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  confirmButtonText: { fontSize: FontSize.md, fontWeight: '700' },
  cancelButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  cancelButtonText: { fontSize: FontSize.md, fontWeight: '600' },

  // MANUAL MODE
  manualInput: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    padding: Spacing.md,
    fontSize: FontSize.md,
    lineHeight: 24,
    textAlignVertical: 'top',
  },

  // Custom store / category picker sheets
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetKvWrapper: { flex: 1, justifyContent: 'flex-end' },
  manualSheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.fab,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: '700' },
  sheetLabel: { fontSize: FontSize.sm, fontWeight: '600', marginTop: Spacing.xs },
  sheetInput: { borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.lg },
  sheetButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  sheetCancelBtn: {
    flex: 1, borderRadius: Radius.md, padding: Spacing.md,
    alignItems: 'center', borderWidth: 1,
  },
  sheetCancelText: { fontWeight: '600', fontSize: FontSize.md },
  sheetAddBtn: { flex: 2, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  sheetAddText: { fontWeight: '700', fontSize: FontSize.md },

  // QR SCANNER
  qrModal: { flex: 1 },
  qrSafeArea: { flex: 1 },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  qrTitle: { fontSize: FontSize.xl, fontWeight: '700' },
  qrHint: { textAlign: 'center', fontSize: FontSize.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  qrCamera: { flex: 1 },
  qrOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  qrFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderRadius: Radius.md,
    backgroundColor: 'transparent',
  },
});
