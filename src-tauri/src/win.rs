//! Yalnızca Windows'ta derlenen kısımlar: WebView2'yi askıya alma ve çevrimdışı konuşma tanıma.

use std::sync::Mutex;

use tauri::WebviewWindow;
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_3;
use webview2_com::TrySuspendCompletedHandler;
use windows::core::{Interface, HSTRING};
use windows::Foundation::Collections::IIterable;
use windows::Foundation::{IAsyncOperation, TimeSpan};
use windows::Globalization::Language;
use windows::Media::SpeechRecognition::{
    SpeechRecognitionConfidence, SpeechRecognitionListConstraint, SpeechRecognitionResult,
    SpeechRecognitionResultStatus, SpeechRecognizer,
};
use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

/// Pencere gizlenince / simge durumuna küçülünce WebView2'yi askıya alır: sayfa donar,
/// zamanlayıcılar ve çizim durur, bellek bir kısmı geri verilir. Pencere açılınca kaldığı
/// yerden devam eder.
pub fn set_webview_suspended(window: &WebviewWindow, suspended: bool) {
    let _ = window.with_webview(move |wv| unsafe {
        let controller = wv.controller();
        // TrySuspend yalnızca görünmez webview'da çalışır
        let _ = controller.SetIsVisible(!suspended);
        let Ok(core) = controller.CoreWebView2() else { return };
        let Ok(core3) = core.cast::<ICoreWebView2_3>() else { return };
        if suspended {
            let handler = TrySuspendCompletedHandler::create(Box::new(|_, _| Ok(())));
            let _ = core3.TrySuspend(&handler);
        } else {
            let _ = core3.Resume();
        }
    });
}

/// Süren tanıma işlemi (Durdur'a basılınca iptal edilir)
static CURRENT: Mutex<Option<IAsyncOperation<SpeechRecognitionResult>>> = Mutex::new(None);

fn init_thread() {
    // WinRT nesneleri için iş parçacığını hazırla (zaten hazırsa zararsız)
    unsafe {
        let _ = RoInitialize(RO_INIT_MULTITHREADED);
    }
}

/// Bu dil için Windows'ta konuşma tanıma paketi yüklü mü?
pub fn speech_available(lang: &str) -> bool {
    init_thread();
    let Ok(list) = SpeechRecognizer::SupportedGrammarLanguages() else { return false };
    let n = list.Size().unwrap_or(0);
    (0..n).any(|i| {
        list.GetAt(i)
            .and_then(|l| l.LanguageTag())
            .map(|t| t.to_string().eq_ignore_ascii_case(lang))
            .unwrap_or(false)
    })
}

/// Bir kez dinler. Tanıyıcı verilen ifadelerle sınırlıdır (çevrimdışı çalışır, internet gerekmez).
/// Duyulan metin ve alternatifleri döner; anlaşılamadıysa boş liste.
pub fn recognize(lang: &str, phrases: Vec<String>) -> Result<Vec<String>, String> {
    init_thread();
    let e = |err: windows::core::Error| err.message().to_string();

    let language = Language::CreateLanguage(&HSTRING::from(lang)).map_err(e)?;
    let rec = SpeechRecognizer::Create(&language)
        .map_err(|_| "Bu dil için Windows konuşma tanıma paketi yüklü değil.".to_string())?;
    let items: Vec<HSTRING> = phrases.iter().map(HSTRING::from).collect();
    let iterable: IIterable<HSTRING> = items.into();
    let constraint = SpeechRecognitionListConstraint::Create(&iterable).map_err(e)?;
    rec.Constraints().map_err(e)?.Append(&constraint).map_err(e)?;
    let compiled = rec.CompileConstraintsAsync().map_err(e)?.join().map_err(e)?;
    if compiled.Status().map_err(e)? != SpeechRecognitionResultStatus::Success {
        return Err("Konuşma tanıma hazırlanamadı.".into());
    }
    if let Ok(t) = rec.Timeouts() {
        let _ = t.SetInitialSilenceTimeout(TimeSpan { Duration: 60_000_000 }); // 6 sn
        let _ = t.SetEndSilenceTimeout(TimeSpan { Duration: 8_000_000 }); // 0,8 sn
    }

    let op = rec.RecognizeAsync().map_err(e)?;
    *CURRENT.lock().unwrap_or_else(|p| p.into_inner()) = Some(op.clone());
    let result = op.join();
    CURRENT.lock().unwrap_or_else(|p| p.into_inner()).take();

    // İptal edildiyse (Durdur) sessizce boş dön
    let Ok(result) = result else { return Ok(vec![]) };
    match result.Status().map_err(e)? {
        SpeechRecognitionResultStatus::Success => {}
        SpeechRecognitionResultStatus::AudioQualityFailure | SpeechRecognitionResultStatus::MicrophoneUnavailable => {
            return Err("Mikrofon kullanılamadı. Windows Ayarlar > Gizlilik > Mikrofon'dan masaüstü uygulamalarına izin ver.".into());
        }
        _ => return Ok(vec![]),
    }
    if result.Confidence().map_err(e)? == SpeechRecognitionConfidence::Rejected {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    let text = result.Text().map_err(e)?.to_string();
    if !text.is_empty() {
        out.push(text);
    }
    if let Ok(alts) = result.GetAlternates(3) {
        for i in 0..alts.Size().unwrap_or(0) {
            if let Ok(a) = alts.GetAt(i) {
                let rejected = a.Confidence().map(|c| c == SpeechRecognitionConfidence::Rejected).unwrap_or(true);
                if let (false, Ok(t)) = (rejected, a.Text()) {
                    let t = t.to_string();
                    if !t.is_empty() && !out.contains(&t) {
                        out.push(t);
                    }
                }
            }
        }
    }
    Ok(out)
}

pub fn stop_recognition() {
    if let Some(op) = CURRENT.lock().unwrap_or_else(|p| p.into_inner()).take() {
        let _ = op.Cancel();
    }
}
