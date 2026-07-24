/**
 * scan.tsx — receipt OCR scanner & QR import
 *
 * Captures or picks a receipt photo, runs ML Kit text recognition, and parses
 * lines into priced items (parseReceiptText lives in lib/receipt). The user picks
 * a store (or enters a custom store name), edits/deselects rows, overrides
 * categories, and confirms. Also hosts a QR scanner that imports shared
 * shopping/task payloads into the shared store.
 *
 * **Moved out of the bottom-nav pager (2026-07-23, UX audit finding E2)**: this used to
 * be one of the 5 co-mounted `app/(tabs)/*` sites (Decision 036); a permanent nav-bar
 * seat for an occasional-use action, and its name ("Scan") only advertised receipt OCR
 * even though it also did QR-share-import — a name-vs-content mismatch, and a candidate
 * for trimming the always-visible tab set. Nothing about the scan/QR functionality
 * itself changed — it's reached via a "Scan" button on app/(tabs)/shopping.tsx's header
 * instead of a bottom tab.
 *
 * Connections:
 *   Imports → components/AppModal, components/HintCard, components/ScreenScaffold, components/Surface, components/PressableScale, constants/theme, lib/date, lib/i18n, lib/receipt, lib/share, lib/siteNav, lib/screenColor, lib/photoStorage, store/useCatalogStore, store/useReceiptStore, store/useMonthlyListStore, store/useSharedStore, store/useShoppingStore, @expo/vector-icons (Ionicons)
 *   Used by → Expo Router route "/scan"; pushed from app/(tabs)/shopping.tsx's header
 *             "Scan" button, and its post-trip receipt pop-up (autoCapture param)
 *   Data    → confirmed items write to FOUR stores: useShoppingStore (shopping_items) + useReceiptStore.addReceipt (receipts, tagged with a monthlyListId — Shopping/Monthly redesign 2026-07-22, picked via renderMonthlyListSelector() when 2+ Monthly lists exist) + useCatalogStore.recordPurchases (purchase_log, linked via receipt_id, + store_items); QR import writes useSharedStore (shared_shopping_items / shared_tasks); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - Decision 001 tier='sub' ScreenScaffold (back arrow, own background) for idle/result/
 *     manual modes — changed from tier='site' (2026-07-23) now that this isn't a pager
 *     sibling anymore; the transient 'scanning' mode stays a bare centered SafeAreaView,
 *     unchanged by the move.
 *   - No Budget entry point here anymore (2026-07-19): the in-content top link that used to open
 *     app/budget.tsx was removed — Budget is reached only from app/(tabs)/shopping.tsx's header now.
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
 *   - **Aspect-ratio formats pass**: addToList() is now async — if a photo was captured/picked
 *     (`imageUri`), it's copied out of ImagePicker/Camera's transient cache into permanent
 *     storage via lib/photoStorage.ts's persistPhoto() (best-effort; a failure just omits the
 *     photo) and threaded into addReceipt() as `photoUri`. addManualItems() never has a photo.
 *   - addManualItems() creates a receipt only when a price is entered with a store selected.
 *   - Both add paths create shopping_items rows with status='inWeeklyList' (not 'catalog').
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen has no
 *     per-screen focus-load.
 *   - **No more pager-swipe guard (removed 2026-07-23)**: while this was a co-mounted pager
 *     tab, an effect flipped the pager's `swipeEnabled` off via `navigation.setOptions`
 *     during OCR/overlay so a stray swipe couldn't abandon the flow. Now that it's a pushed
 *     sub-screen, a swipe can't reach the pager underneath it at all — the guard is gone,
 *     along with its `useNavigation`/`MaterialTopTabNavigationProp` imports.
 *   - `mountedRef` still guards the OCR pipeline's deferred setState (100ms picker hop +
 *     1800ms result hold) from firing after this screen unmounts — same contract as before,
 *     just "unmounts" now means "user navigated back" instead of "pager swiped away."
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useSharedStore } from '@/store/useSharedStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useReceiptStore } from '@/store/useReceiptStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { formatKr } from '@/lib/money';
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import Surface from '@/components/Surface';
import ScreenScaffold from '@/components/ScreenScaffold';
import { goToSite } from '@/lib/siteNav';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';
import { decodeSharePayload } from '@/lib/share';
import { parseReceiptText, findFuzzyMatch, ParsedReceiptItem as ParsedItem } from '@/lib/receipt';
import { persistPhoto } from '@/lib/photoStorage';
import { Fonts, FontSize, Radius, Shadow, Spacing, rgba } from '@/constants/theme';
import { useAppTheme, useScaledStyles, useAccessibility } from '@/lib/useAppTheme';

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
  const { autoCapture } = useLocalSearchParams<{ autoCapture?: 'camera' | 'library' }>();
  const addShopping = useShoppingStore((s) => s.add);
  const updateShoppingItem = useShoppingStore((s) => s.update);
  const shoppingItems = useShoppingStore((s) => s.items);
  const recordPurchases = useCatalogStore((s) => s.recordPurchases);
  const catalogStoreItems = useCatalogStore((s) => s.items);
  const addReceipt = useReceiptStore((s) => s.addReceipt);
  const monthlyLists = useMonthlyListStore((s) => s.lists);
  const addSharedShopping = useSharedStore((s) => s.addSharedShopping);
  const addSharedTasks = useSharedStore((s) => s.addSharedTasks);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const { reducedMotion } = useAccessibility();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScreenMode>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  // Shopping — Monthly redesign (2026-07-22): which Monthly list this receipt's spend counts
  // against (useReceiptStore's monthlyListId). '' = not explicitly picked — falls back to the
  // first list at add-time (effectiveMonthlyListId below), same auto-pick as the single-list
  // common case, where the picker UI doesn't even render.
  const [selectedMonthlyListId, setSelectedMonthlyListId] = useState('');
  // Falls back to the first Monthly list when nothing's explicitly picked (the picker UI
  // itself only renders once there's more than one list to choose between).
  const effectiveMonthlyListId = selectedMonthlyListId || monthlyLists[0]?.id;
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
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const autoCaptureFired = useRef(false);
  // Guards the deferred setState in the OCR pipeline (100ms picker hop + 1800ms result
  // hold) from firing after this screen unmounts.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Shopping's post-trip receipt pop-up routes here with autoCapture to go straight into the
  // camera/library picker — guarded so a remount never re-fires the same auto-capture.
  useEffect(() => {
    if (autoCaptureFired.current || !autoCapture) return;
    autoCaptureFired.current = true;
    if (autoCapture === 'camera') takePhoto();
    else if (autoCapture === 'library') pickImage();
  // takePhoto/pickImage are plain functions recreated every render; autoCaptureFired guards
  // against them firing more than once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCapture]);

  // Pulsing animation for scanning state. Captured in a ref and stopped on mode-change/
  // unmount — an uncaptured Animated.loop keeps running (and drawing) forever once the
  // screen leaves 'scanning'. Skipped under reduce-motion.
  useEffect(() => {
    if (mode === 'scanning' && !reducedMotion) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.14, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => { pulseRef.current?.stop(); };
  }, [mode, reducedMotion, pulseAnim]);

  // Auto-focus manual input when entering manual mode.
  useEffect(() => {
    if (mode === 'manual') {
      const id = setTimeout(() => manualInputRef.current?.focus(), 100);
      return () => clearTimeout(id);
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
      if (!mountedRef.current) return;
      const items = parseReceiptText(result.text);
      if (items.length > 0) {
        const enrichedItems = enrichItemsWithCategories(items);
        setParsedItems(enrichedItems);
        await new Promise((resolve) => setTimeout(resolve, 1800));
        if (!mountedRef.current) return;
        setMode('result');
      } else {
        handleOcrFailure();
      }
    } catch {
      handleOcrFailure();
    }
  }

  function handleOcrFailure() {
    if (!mountedRef.current) return;
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
      const receipt = addReceipt({ date: todayStr(), store: selectedStore, total: price, category: 'groceries', monthlyListId: effectiveMonthlyListId });
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

  async function addToList() {
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

    // Copy the scanned photo out of ImagePicker/Camera's transient cache into
    // permanent storage so it survives after this screen unmounts. Best-effort —
    // a persist failure shouldn't block adding the scanned items.
    let photoUri: string | undefined;
    if (imageUri) {
      try {
        photoUri = await persistPhoto(imageUri, 'receipts');
      } catch {
        photoUri = undefined;
      }
    }

    const receiptId = selected.length
      ? addReceipt({
          date: todayStr(),
          store: selectedStore,
          total: selected.reduce((sum, item) => sum + item.price, 0),
          category: 'groceries',
          monthlyListId: effectiveMonthlyListId,
          photoUri,
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
        <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.store.toUpperCase()}</Text>
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

  // Shopping — Monthly redesign (2026-07-22): which Monthly list this receipt's spend
  // counts against. Only rendered once there's actually a choice to make (2+ lists) — the
  // common single-list case shows no extra UI at all, matching "keep the logic complex, but
  // usage simple."
  function renderMonthlyListSelector() {
    if (monthlyLists.length < 2) return null;
    return (
      <View style={styles.storeSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.monthlyListSection.toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeScroll}>
          <View style={styles.storeRow}>
            {monthlyLists.map((list) => (
              <PressableScale
                key={list.id}
                style={[
                  styles.storeChip,
                  { borderWidth: 1, borderColor: theme.border },
                  effectiveMonthlyListId === list.id && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}
                onPress={() => setSelectedMonthlyListId(list.id)}
                scaleTo={0.97}
              >
                <Text style={[styles.storeChipText, { color: theme.text }, effectiveMonthlyListId === list.id && { color: theme.accentInk }]} numberOfLines={1}>
                  {list.name}
                </Text>
              </PressableScale>
            ))}
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
        <ScreenScaffold title={t.scanReceipt} tier="sub" onBack={() => router.back()}>
          <View style={styles.content}>
            {/* Tip — subtle bordered card with an info glyph, not a flat colour block.
                Edge tinted to the inner accent (theme.good) so border matches content,
                not the violet screen hue (debug-note 2026-07-21). */}
            <Surface borderColor={theme.good} style={styles.tipCardRow}>
              <View style={[styles.tipAccent, { backgroundColor: theme.good }]} />
              <Ionicons name="bulb-outline" size={18} color={theme.good} style={styles.tipIcon} />
              <Text style={[styles.tipText, { color: theme.text }]}>{t.scanHintBanner}</Text>
            </Surface>

            {/* Primary camera button — the hero action. Debug notes: anchor this one button
                (not the option cards below) — one DebugNoteAnchor per region. */}
            <DebugNoteAnchor id="scan.takePhoto" label="Scan — Take photo">
            <PressableScale
              style={[styles.primaryButton, { backgroundColor: theme.accent, shadowColor: theme.shadow }]}
              onPress={takePhoto}
              scaleTo={0.95}
            >
              <Ionicons name="camera-outline" size={46} color={theme.accentInk} />
              <Text style={[styles.primaryButtonText, { color: theme.accentInk }]}>{t.takePhoto}</Text>
            </PressableScale>
            </DebugNoteAnchor>

            {/* Other ways to add — consistent bordered option cards with a tinted icon
                badge each, so they read as distinct choices instead of flat colour blocks. */}
            <View style={styles.optionList}>
              {[
                { icon: 'images-outline' as const, color: theme.featShop, label: t.chooseFromLibrary, onPress: pickImage },
                { icon: 'pencil-outline' as const, color: theme.featBudget, label: t.addManually, onPress: () => setMode('manual') },
                { icon: 'qr-code-outline' as const, color: theme.good, label: t.scanQrCode, onPress: openQrScanner },
              ].map((opt) => (
                <PressableScale key={opt.label} onPress={opt.onPress} scaleTo={0.98}>
                  <Surface borderColor={opt.color} style={styles.optionCardRow}>
                    <View style={[styles.optionBadge, { backgroundColor: rgba(opt.color, 0.16) }]}>
                      <Ionicons name={opt.icon} size={22} color={opt.color} />
                    </View>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{opt.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                  </Surface>
                </PressableScale>
              ))}
            </View>

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
        <ScreenScaffold title={t.foundOnReceipt} tier="sub" onBack={() => router.back()}>
          <View style={styles.content}>
            <HintCard text={t.itemsSelectedCount(selectedCount, parsedItems.length)} example="" />
            {renderMonthlyListSelector()}

            {/* Debug notes: anchor the found-items card (not each row/checkbox inside). */}
            <DebugNoteAnchor id="scan.items" label="Scan — Found items">
            <Surface borderColor={theme.accent} style={styles.itemsCard}>
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
                      placeholder={t.shoppingItemPlaceholder}
                      placeholderTextColor={theme.textMuted}
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
            </DebugNoteAnchor>

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
        <ScreenScaffold title={t.manualEntryTitle} tier="sub" onBack={() => router.back()}>
          <View style={styles.content}>
            <HintCard text={t.manualEntryHint} example="" />

            {renderStoreSelector()}
            {renderMonthlyListSelector()}

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
  backLink: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  tipCardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, paddingLeft: Spacing.lg },
  tipAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: Radius.md, borderBottomLeftRadius: Radius.md },
  tipIcon: {},
  tipText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },

  storeSection: { gap: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, letterSpacing: 0.07 },
  storeScroll: {},
  storeRow: { flexDirection: 'row', gap: Spacing.sm },
  storeChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  storeChipText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },

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
  primaryButtonText: { fontSize: FontSize.xl, fontFamily: Fonts.bold },

  optionList: { gap: Spacing.sm },
  optionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  optionBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold },

  // SCANNING MODE
  scanningContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.xl },
  pulseCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningTitle: { fontSize: FontSize.lg, fontFamily: Fonts.semibold, textAlign: 'center' },
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
  checkMark: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  itemName: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.medium },
  itemQty: { fontSize: FontSize.sm, minWidth: 40 },
  itemPrice: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, minWidth: 44, textAlign: 'right' },
  totalRow: { paddingTop: Spacing.sm, paddingBottom: Spacing.sm, alignItems: 'flex-end' },
  totalText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },

  categoryChip: {
    alignSelf: 'flex-start',
    marginLeft: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  categoryChipText: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  categoryGrid: { maxHeight: 280 },
  categoryGridContent: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingVertical: Spacing.sm },
  categoryOption: {
    width: '48%',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  categoryOptionText: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },

  // BUTTONS
  confirmButton: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  confirmButtonText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  cancelButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  cancelButtonText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },

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
  sheetTitle: { fontSize: FontSize.xl, fontFamily: Fonts.bold },
  sheetLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, marginTop: Spacing.xs },
  sheetInput: { borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.lg },
  sheetButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  sheetCancelBtn: {
    flex: 1, borderRadius: Radius.md, padding: Spacing.md,
    alignItems: 'center', borderWidth: 1,
  },
  sheetCancelText: { fontFamily: Fonts.semibold, fontSize: FontSize.md },
  sheetAddBtn: { flex: 2, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  sheetAddText: { fontFamily: Fonts.bold, fontSize: FontSize.md },

  // QR SCANNER
  qrModal: { flex: 1 },
  qrSafeArea: { flex: 1 },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  qrTitle: { fontSize: FontSize.xl, fontFamily: Fonts.bold },
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
