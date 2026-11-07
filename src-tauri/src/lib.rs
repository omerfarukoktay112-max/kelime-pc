//! kelime masaüstü uygulaması: pencere, sistem tepsisi, SQLite kaydı ve Windows servisleri.
//!
//! Arkada açık beklerken kaynak tüketmemesi için:
//! - Pencere kapatılınca (ayar açıksa) uygulama tepsiye gizlenir ve WebView2 askıya alınır.
//! - Simge durumuna küçültülünce de aynı şekilde askıya alınır.
//! - Arka planda çalışan hiçbir zamanlayıcı ya da sürekli kontrol yoktur.

mod db;
#[cfg(windows)]
mod win;

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State, WebviewWindow, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_window_state::StateFlags;

use db::{Db, Loaded, Op};

const SOURCE_URL: &str = "https://github.com/tema4p/english-vocabulary";

struct AppState {
    db: Db,
    close_to_tray: AtomicBool,
    shown: AtomicBool,
    suspended: AtomicBool,
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

// ---------- Komutlar (ön yüz: src/platform/backend.ts) ----------

#[tauri::command]
fn load_state(state: State<AppState>) -> Result<Loaded, String> {
    state.db.load().map_err(err)
}

#[tauri::command]
fn apply_ops(state: State<AppState>, ops: Vec<Op>) -> Result<(), String> {
    state.db.apply(&ops).map_err(err)?;
    for op in &ops {
        match op {
            Op::Kv { key, value } if key == "settings" => {
                state.close_to_tray.store(db::close_to_tray(Some(value)), Ordering::Relaxed);
            }
            Op::ClearAll => state.close_to_tray.store(true, Ordering::Relaxed),
            _ => {}
        }
    }
    Ok(())
}

/// İlk çizimden sonra ön yüz çağırır: pencere boş/beyaz görünmeden açılır.
#[tauri::command]
fn window_ready(window: WebviewWindow, state: State<AppState>) {
    if !state.shown.swap(true, Ordering::Relaxed) {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
async fn export_backup(app: AppHandle, json: String, file_name: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = app
            .dialog()
            .file()
            .set_title("Kelime yedeğini kaydet")
            .set_file_name(&file_name)
            .add_filter("Kelime yedeği", &["json"])
            .blocking_save_file()
        else {
            return Ok(false);
        };
        let path = path.into_path().map_err(err)?;
        std::fs::write(path, json).map_err(err)?;
        Ok(true)
    })
    .await
    .map_err(err)?
}

#[tauri::command]
async fn import_backup(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = app
            .dialog()
            .file()
            .set_title("Kelime yedeğini seç")
            .add_filter("Kelime yedeği", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = path.into_path().map_err(err)?;
        // Yedek dosyası birkaç yüz KB olur; çok büyük bir dosya yanlış seçilmiştir
        if std::fs::metadata(&path).map_err(err)?.len() > 20 * 1024 * 1024 {
            return Err("Bu dosya bir Kelime yedeği olamayacak kadar büyük.".into());
        }
        std::fs::read_to_string(path).map(Some).map_err(err)
    })
    .await
    .map_err(err)?
}

#[tauri::command]
fn open_source_page() {
    #[cfg(windows)]
    let cmd = std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", SOURCE_URL]).spawn();
    #[cfg(target_os = "macos")]
    let cmd = std::process::Command::new("open").arg(SOURCE_URL).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let cmd = std::process::Command::new("xdg-open").arg(SOURCE_URL).spawn();
    let _ = cmd;
}

#[tauri::command]
async fn speech_available(lang: String) -> bool {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || win::speech_available(&lang)).await.unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        let _ = lang;
        false
    }
}

#[tauri::command]
async fn recognize(lang: String, phrases: Vec<String>) -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || win::recognize(&lang, phrases)).await.map_err(err)?
    }
    #[cfg(not(windows))]
    {
        let _ = (lang, phrases);
        Err("Konuşma tanıma yalnızca Windows'ta var.".into())
    }
}

#[tauri::command]
fn stop_recognition() {
    #[cfg(windows)]
    win::stop_recognition();
}

// ---------- Pencere ----------

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn set_suspended(window: &WebviewWindow, suspended: bool) {
    let state = window.state::<AppState>();
    if state.suspended.swap(suspended, Ordering::Relaxed) == suspended {
        return;
    }
    #[cfg(windows)]
    win::set_webview_suspended(window, suspended);
}

fn show_main(app: &AppHandle) {
    if let Some(w) = main_window(app) {
        set_suspended(&w, false);
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn hide_main(window: &WebviewWindow) {
    let _ = window.hide();
    set_suspended(window, true);
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "kelime'yi aç", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("kelime")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // İkinci kez açılırsa yeni kopya başlatma; tepsideki pencereyi öne getir
        .plugin(tauri_plugin_single_instance::init(|app, _, _| show_main(app)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Pencere gizli açılıp ilk çizimden sonra gösterilir; görünürlük hatırlanmasın
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db = Db::open(&dir.join("kelime.db"))?;
            let close_to_tray = db::close_to_tray(db.kv("settings").as_deref());
            app.manage(AppState {
                db,
                close_to_tray: AtomicBool::new(close_to_tray),
                shown: AtomicBool::new(false),
                suspended: AtomicBool::new(false),
            });
            build_tray(app.handle())?;

            // Ön yüz bir sebeple "hazırım" diyemezse pencere yine de açılsın
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(3));
                let state = handle.state::<AppState>();
                if !state.shown.swap(true, Ordering::Relaxed) {
                    show_main(&handle);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            let Some(w) = window.app_handle().get_webview_window(window.label()) else { return };
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    if w.state::<AppState>().close_to_tray.load(Ordering::Relaxed) {
                        api.prevent_close();
                        hide_main(&w);
                    }
                }
                WindowEvent::Resized(_) => {
                    // Simge durumuna küçültülünce askıya al, geri gelince devam et
                    let minimized = w.is_minimized().unwrap_or(false);
                    let visible = w.is_visible().unwrap_or(true);
                    if visible {
                        set_suspended(&w, minimized);
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_state,
            apply_ops,
            window_ready,
            export_backup,
            import_backup,
            open_source_page,
            speech_available,
            recognize,
            stop_recognition
        ])
        .run(tauri::generate_context!())
        .expect("kelime başlatılamadı");
}
