import { Icon } from '@/components/Icon';
import { TabBar } from '@/components/TabBar';
import { C, Txt } from '@/components/Txt';
import { Screen, Switch } from '@/components/ui';
import { formatSetting, SETTING_OPTIONS, type Settings as SettingsT } from '@/core/settings';
import { getBackend } from '@/platform/backend';
import {
  exportBackupJson,
  getSnapshot,
  importBackupJson,
  nav,
  resetProgress,
  showDialog,
  showToast,
  updateSettings,
  useStore,
} from '@/store/store';

type CycleKey = keyof typeof SETTING_OPTIONS;
type ToggleKey = { [K in keyof SettingsT]: SettingsT[K] extends boolean ? K : never }[keyof SettingsT];

type Row =
  | { kind: 'cycle'; key: CycleKey; label: string }
  | { kind: 'toggle'; key: ToggleKey; label: string; hint?: string }
  | { kind: 'action'; label: string; value?: string; onPress: () => void }
  | { kind: 'info'; label: string; value: string }
  | { kind: 'danger'; label: string; onPress: () => void };

const VERSION = '1.0.0';

async function backup() {
  try {
    const saved = await getBackend().exportBackup(exportBackupJson(), `kelime-yedek-${new Date().toISOString().slice(0, 10)}.json`);
    if (saved) showToast('Yedek kaydedildi.');
  } catch (e) {
    showDialog({ title: 'Yedeklenemedi', message: String(e) });
  }
}

async function restore() {
  let json: string | null;
  try {
    json = await getBackend().importBackup();
  } catch (e) {
    showDialog({ title: 'Dosya açılamadı', message: String(e) });
    return;
  }
  if (json === null) return;
  showDialog({
    title: 'Yedeği geri yükle',
    message: 'Şu anki ilerlemen, pasif kelimelerin ve ayarların yedektekilerle değişecek. Telefonda alınan yedek de yüklenebilir.',
    confirm: 'Geri yükle',
    danger: true,
    onConfirm: () => {
      try {
        importBackupJson(json);
        showToast('Yedek geri yüklendi.');
      } catch (e) {
        showDialog({ title: 'Geri yüklenemedi', message: (e as Error).message });
      }
    },
  });
}

function cycle(key: CycleKey) {
  const settings = getSnapshot().settings;
  const options = SETTING_OPTIONS[key] as readonly SettingsT[CycleKey][];
  const i = options.indexOf(settings[key]);
  updateSettings({ [key]: options[(i + 1) % options.length] } as Partial<SettingsT>);
}

const confirmReset = () =>
  showDialog({
    title: 'İlerlemeyi sıfırla',
    message: 'Tüm seviyelerdeki öğrenme ilerlemen ve ağacın sıfırlanacak. Pasif kelimeler ve ayarlar korunur. Emin misin?',
    confirm: 'Sıfırla',
    danger: true,
    onConfirm: resetProgress,
  });

/** 8 · Ayarlar */
export function Settings() {
  const settings = useStore((s) => s.settings);
  const lastLevel = useStore((s) => s.lastLevel);
  const desktop = getBackend().desktop;

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'Çalışma',
      rows: [
        { kind: 'cycle', key: 'dailyGoal', label: 'Günlük hedef' },
        { kind: 'cycle', key: 'defaultRounds', label: 'Varsayılan tur sayısı' },
        { kind: 'cycle', key: 'direction', label: 'Soru yönü' },
        { kind: 'toggle', key: 'autoplay', label: 'Kelimeyi otomatik seslendir' },
      ],
    },
    {
      title: 'Ses',
      rows: [
        { kind: 'cycle', key: 'accent', label: 'Aksan' },
        { kind: 'cycle', key: 'speechRate', label: 'Konuşma hızı' },
        { kind: 'toggle', key: 'microphone', label: 'Sesli modda mikrofonla cevapla' },
        { kind: 'toggle', key: 'sfx', label: 'Ses efektleri' },
      ],
    },
    {
      title: 'Görünüm',
      rows: [
        { kind: 'cycle', key: 'theme', label: 'Tema' },
        { kind: 'cycle', key: 'fontSize', label: 'Yazı boyutu' },
      ],
    },
    ...(desktop
      ? [
          {
            title: 'Pencere',
            rows: [
              {
                kind: 'toggle',
                key: 'closeToTray',
                label: 'Kapatınca sistem tepsisinde beklesin',
                hint: 'Açıkken pencereyi kapatmak uygulamayı tepsiye gizler; tamamen kapatmak için tepsi simgesinden Çıkış.',
              } as Row,
            ],
          },
        ]
      : []),
    {
      title: 'Veri',
      rows: [
        { kind: 'action', label: 'Pasif kelimeler', value: lastLevel, onPress: () => nav.push({ name: 'words', level: lastLevel }) },
        { kind: 'action', label: 'Yedekle (dosyaya kaydet)', onPress: backup },
        { kind: 'action', label: 'Yedekten geri yükle', onPress: restore },
        { kind: 'danger', label: 'İlerlemeyi sıfırla', onPress: confirmReset },
      ],
    },
    {
      title: 'Hakkında',
      rows: [
        { kind: 'action', label: 'Kelime kaynağı', value: 'CC BY-NC 4.0', onPress: () => getBackend().openSourcePage() },
        { kind: 'info', label: 'Sürüm', value: VERSION },
      ],
    },
  ];

  return (
    <Screen>
      <Txt variant="display" size={44} style={{ marginTop: 8 }}>
        Ayarlar
      </Txt>

      <div className="scroll col" style={{ marginTop: 20, marginBottom: 12, gap: 24, paddingBottom: 8 }}>
        {sections.map((sec) => (
          <section key={sec.title} className="col" style={{ gap: 8 }}>
            <Txt variant="caps" size={14}>
              {sec.title}
            </Txt>
            <div className="settings-group">
              {sec.rows.map((r) => {
                if (r.kind === 'toggle') {
                  return (
                    <div key={r.label} className="settings-row row" style={{ paddingRight: 8 }}>
                      <div className="col" style={{ flex: 1, gap: 2, padding: r.hint ? '10px 0' : 0 }}>
                        <Txt variant="medium" size={17}>
                          {r.label}
                        </Txt>
                        {r.hint && (
                          <Txt size={13} color={C.textMuted}>
                            {r.hint}
                          </Txt>
                        )}
                      </div>
                      <Switch label={r.label} value={settings[r.key]} onChange={() => updateSettings({ [r.key]: !settings[r.key] })} />
                    </div>
                  );
                }
                if (r.kind === 'info') {
                  return (
                    <div key={r.label} className="settings-row row">
                      <Txt variant="medium" size={17} style={{ flex: 1 }}>
                        {r.label}
                      </Txt>
                      <Txt size={16} color={C.textMuted}>
                        {r.value}
                      </Txt>
                    </div>
                  );
                }
                if (r.kind === 'danger') {
                  return (
                    <button key={r.label} type="button" onClick={r.onPress} className="settings-row row">
                      <Txt variant="bold" size={17} color={C.danger}>
                        {r.label}
                      </Txt>
                    </button>
                  );
                }
                const value = r.kind === 'cycle' ? formatSetting(r.key, settings[r.key] as never) : (r.value ?? '');
                return (
                  <button
                    key={r.label}
                    type="button"
                    title={r.kind === 'cycle' ? 'Tıklayınca sonraki seçeneğe geçer' : undefined}
                    onClick={r.kind === 'cycle' ? () => cycle(r.key) : r.onPress}
                    className="settings-row row"
                  >
                    <Txt variant="medium" size={17} style={{ flex: 1 }}>
                      {r.label}
                    </Txt>
                    <div className="row" style={{ gap: 6 }}>
                      {!!value && (
                        <Txt size={16} color={C.textMuted}>
                          {value}
                        </Txt>
                      )}
                      <Icon name="chevron" size={18} color={C.textMuted} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <TabBar active="settings" />
    </Screen>
  );
}
