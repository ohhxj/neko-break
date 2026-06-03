#[cfg(target_os = "macos")]
use crate::{app_state::AppState, commands::window::NativeOverlayMedia};
#[cfg(target_os = "macos")]
use objc2::{
    rc::Retained,
    runtime::AnyObject,
    MainThreadMarker,
};
#[cfg(target_os = "macos")]
use objc2_app_kit::{NSColor, NSWindow};
#[cfg(target_os = "macos")]
use objc2_av_foundation::{
    AVLayerVideoGravityResizeAspect, AVPlayerLayer, AVPlayerLooper, AVPlayerItem, AVQueuePlayer,
};
#[cfg(target_os = "macos")]
use objc2_foundation::NSURL;
#[cfg(target_os = "macos")]
use objc2_quartz_core::{CAAutoresizingMask, CATransaction};
#[cfg(target_os = "macos")]
use tauri::{Manager, WebviewWindow};

#[cfg(target_os = "macos")]
pub fn sync_overlay_video(
    app: &tauri::AppHandle,
    window: &WebviewWindow,
    media: Option<&NativeOverlayMedia>,
) -> tauri::Result<()> {
    let Some(media) = media else {
        return Ok(());
    };

    // 优先尝试双层（入场 + 循环）模式：两个 path 都给出且格式都是 mov_alpha。
    let dual = match (
        media.intro_file_path.as_ref(),
        media.loop_file_path.as_ref(),
    ) {
        (Some(intro_path), Some(loop_path))
            if media.intro_format.as_deref() == Some("mov_alpha")
                && media.loop_format.as_deref() == Some("mov_alpha") =>
        {
            Some((
                intro_path.clone(),
                loop_path.clone(),
                media.intro_duration_ms.unwrap_or(0),
            ))
        }
        _ => None,
    };

    if let Some((intro_path, loop_path, intro_duration_ms)) = dual {
        return setup_dual_layer(app, window, intro_path, loop_path, intro_duration_ms);
    }

    // 兜底：旧的单层逻辑
    let should_play_native = media
        .file_path
        .as_ref()
        .zip(media.format.as_ref())
        .map(|(_, format)| format == "mov_alpha")
        .unwrap_or(false);

    if !should_play_native {
        teardown_overlay_video(app)?;
        return Ok(());
    }

    let Some(file_path) = media.file_path.clone() else {
        teardown_overlay_video(app)?;
        return Ok(());
    };
    let should_loop = media.should_loop.unwrap_or(true);
    let next_file_path = media.next_file_path.clone();
    let next_format = media.next_format.clone();
    let should_chain_into_loop =
        next_file_path.is_some() && next_format.as_deref() == Some("mov_alpha");

    let app_handle = app.clone();
    let window_handle = window.clone();
    app.run_on_main_thread(move || unsafe {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };

        let Ok(ns_window_ptr) = window_handle.ns_window() else {
            return;
        };

        let ns_window = &*(ns_window_ptr.cast::<NSWindow>());
        ns_window.setOpaque(false);
        ns_window.setBackgroundColor(Some(&NSColor::clearColor()));
        ns_window.setHasShadow(false);

        let Some(content_view) = ns_window.contentView() else {
            return;
        };

        let Some(url) = NSURL::from_file_path(&file_path) else {
            return;
        };

        let initial_item = AVPlayerItem::playerItemWithURL(&url, mtm);
        let player = AVQueuePlayer::playerWithPlayerItem(Some(&initial_item), mtm);
        player.setMuted(true);
        player.setAllowsExternalPlayback(false);
        player.setAutomaticallyWaitsToMinimizeStalling(false);

        let looper = if should_chain_into_loop {
            let Some(loop_path) = next_file_path.as_ref() else {
                return;
            };
            let Some(loop_url) = NSURL::from_file_path(loop_path) else {
                return;
            };
            let loop_item = AVPlayerItem::playerItemWithURL(&loop_url, mtm);
            Some(AVPlayerLooper::playerLooperWithPlayer_templateItem(&player, &loop_item))
        } else if should_loop {
            Some(AVPlayerLooper::playerLooperWithPlayer_templateItem(&player, &initial_item))
        } else {
            None
        };
        let layer = AVPlayerLayer::playerLayerWithPlayer(Some(&player));
        if let Some(video_gravity) = AVLayerVideoGravityResizeAspect {
            layer.setVideoGravity(video_gravity);
        }
        layer.setOpaque(false);
        layer.setNeedsDisplayOnBoundsChange(true);
        layer.setAutoresizingMask(
            CAAutoresizingMask::LayerWidthSizable | CAAutoresizingMask::LayerHeightSizable,
        );
        layer.setFrame(content_view.bounds());

        content_view.setWantsLayer(true);
        if let Some(host_layer) = content_view.layer() {
            host_layer.setOpaque(false);
            host_layer.setBackgroundColor(None);
            host_layer.setMasksToBounds(false);
            host_layer.addSublayer(&layer);
        }

        player.play();
        replace_native_overlay_objects(&app_handle, layer, player, looper);
    })
}

#[cfg(target_os = "macos")]
fn setup_dual_layer(
    app: &tauri::AppHandle,
    window: &WebviewWindow,
    intro_path: String,
    loop_path: String,
    intro_duration_ms: u64,
) -> tauri::Result<()> {
    let app_handle = app.clone();
    let window_handle = window.clone();
    app.run_on_main_thread(move || unsafe {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };

        let Ok(ns_window_ptr) = window_handle.ns_window() else {
            return;
        };

        let ns_window = &*(ns_window_ptr.cast::<NSWindow>());
        ns_window.setOpaque(false);
        ns_window.setBackgroundColor(Some(&NSColor::clearColor()));
        ns_window.setHasShadow(false);

        let Some(content_view) = ns_window.contentView() else {
            return;
        };

        // -- 循环层：AVQueuePlayer + AVPlayerLooper 无缝循环 --
        let Some(loop_url) = NSURL::from_file_path(&loop_path) else {
            return;
        };
        let loop_item = AVPlayerItem::playerItemWithURL(&loop_url, mtm);
        // 关键：AVPlayerLooper 要求 AVQueuePlayer 初始为【空队列】，由 looper 用
        // templateItem 自行填充副本并接管循环。若预先把 loop_item 塞进 player，
        // 会与 looper 冲突 → 不循环。这是「没循环」的根因。
        let loop_player = AVQueuePlayer::playerWithPlayerItem(None, mtm);
        loop_player.setMuted(true);
        loop_player.setAllowsExternalPlayback(false);
        loop_player.setAutomaticallyWaitsToMinimizeStalling(false);
        let loop_looper =
            AVPlayerLooper::playerLooperWithPlayer_templateItem(&loop_player, &loop_item);

        let loop_layer = AVPlayerLayer::playerLayerWithPlayer(Some(&loop_player));
        if let Some(video_gravity) = AVLayerVideoGravityResizeAspect {
            loop_layer.setVideoGravity(video_gravity);
        }
        loop_layer.setOpaque(false);
        loop_layer.setNeedsDisplayOnBoundsChange(true);
        loop_layer.setAutoresizingMask(
            CAAutoresizingMask::LayerWidthSizable | CAAutoresizingMask::LayerHeightSizable,
        );
        loop_layer.setFrame(content_view.bounds());
        // 循环层先隐藏，避免它的静止首帧透过入场层的透明区与入场的猫重叠
        loop_layer.setOpacity(0.0);

        // -- 入场层：单次播放 AVPlayer --
        let Some(intro_url) = NSURL::from_file_path(&intro_path) else {
            return;
        };
        let intro_item = AVPlayerItem::playerItemWithURL(&intro_url, mtm);
        let intro_player = AVQueuePlayer::playerWithPlayerItem(Some(&intro_item), mtm);
        intro_player.setMuted(true);
        intro_player.setAllowsExternalPlayback(false);
        intro_player.setAutomaticallyWaitsToMinimizeStalling(false);

        let intro_layer = AVPlayerLayer::playerLayerWithPlayer(Some(&intro_player));
        if let Some(video_gravity) = AVLayerVideoGravityResizeAspect {
            intro_layer.setVideoGravity(video_gravity);
        }
        intro_layer.setOpaque(false);
        intro_layer.setNeedsDisplayOnBoundsChange(true);
        intro_layer.setAutoresizingMask(
            CAAutoresizingMask::LayerWidthSizable | CAAutoresizingMask::LayerHeightSizable,
        );
        intro_layer.setFrame(content_view.bounds());

        // 挂载：循环层在底（addSublayer 先调用），入场层在上
        content_view.setWantsLayer(true);
        if let Some(host_layer) = content_view.layer() {
            host_layer.setOpaque(false);
            host_layer.setBackgroundColor(None);
            host_layer.setMasksToBounds(false);
            host_layer.addSublayer(&loop_layer);
            host_layer.addSublayer(&intro_layer);
        }

        // 关键改动：循环层【不】提前播放。它停在第 0 帧（新建 player 默认即在 0）、
        // 保持隐藏，由 AVQueuePlayer 自动缓冲首帧。等入场结束的瞬间再从第 0 帧启动，
        // 保证「入场最后一帧 → 循环第 0 帧」姿势连续、不跳变。
        intro_player.play();

        replace_native_overlay_dual_objects(
            &app_handle,
            intro_layer,
            intro_player,
            loop_layer,
            loop_player,
            loop_looper,
        );
    })?;

    // 入场时长结束后，在主线程上「同帧」完成切换：
    // 循环层显形 + 从第 0 帧开始播放，同时入场层隐藏 + 暂停。
    if intro_duration_ms > 0 {
        let app_for_swap = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(intro_duration_ms)).await;
            let app_for_main = app_for_swap.clone();
            let _ = app_for_swap.run_on_main_thread(move || unsafe {
                swap_intro_to_loop(&app_for_main);
            });
        });
    }

    Ok(())
}

#[cfg(target_os = "macos")]
unsafe fn swap_intro_to_loop(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let overlay = state
        .native_overlay
        .lock()
        .expect("native overlay mutex poisoned");

    // 用 CATransaction 禁用隐式动画，保证 opacity 翻转是「同帧硬切」，
    // 而不是默认的 ~0.25s 渐隐（渐隐期间两层都半透明 → 正是闪动/重叠的来源）。
    CATransaction::begin();
    CATransaction::setDisableActions(true);

    // 双层模式下：loop 的 player 存在 player_ptr，loop 的 layer 存在 layer_ptr
    if overlay.player_ptr != 0 {
        let loop_player = &*(overlay.player_ptr as *mut AVQueuePlayer);
        loop_player.play();
    }
    if overlay.layer_ptr != 0 {
        let loop_layer = &*(overlay.layer_ptr as *mut AVPlayerLayer);
        loop_layer.setOpacity(1.0);
    }
    if overlay.intro_layer_ptr != 0 {
        let intro_layer = &*(overlay.intro_layer_ptr as *mut AVPlayerLayer);
        intro_layer.setOpacity(0.0);
    }
    if overlay.intro_player_ptr != 0 {
        let intro_player = &*(overlay.intro_player_ptr as *mut AVQueuePlayer);
        intro_player.pause();
    }

    CATransaction::commit();
}

#[cfg(not(target_os = "macos"))]
pub fn sync_overlay_video(
    _app: &tauri::AppHandle,
    _window: &tauri::WebviewWindow,
    _media: Option<&crate::commands::window::NativeOverlayMedia>,
) -> tauri::Result<()> {
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn teardown_overlay_video(app: &tauri::AppHandle) -> tauri::Result<()> {
    let app_handle = app.clone();
    app.run_on_main_thread(move || unsafe {
        release_native_overlay_objects(&app_handle);
    })
}

#[cfg(not(target_os = "macos"))]
pub fn teardown_overlay_video(_app: &tauri::AppHandle) -> tauri::Result<()> {
    Ok(())
}

#[cfg(target_os = "macos")]
unsafe fn release_native_overlay_objects(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let mut overlay = state
        .native_overlay
        .lock()
        .expect("native overlay mutex poisoned");
    let layer_ptr = overlay.layer_ptr;
    let player_ptr = overlay.player_ptr;
    let looper_ptr = overlay.looper_ptr;
    let intro_layer_ptr = overlay.intro_layer_ptr;
    let intro_player_ptr = overlay.intro_player_ptr;
    overlay.layer_ptr = 0;
    overlay.player_ptr = 0;
    overlay.looper_ptr = 0;
    overlay.intro_layer_ptr = 0;
    overlay.intro_player_ptr = 0;
    drop(overlay);

    release_intro_layer_raw(intro_layer_ptr, intro_player_ptr);
    release_native_overlay_objects_raw(layer_ptr, player_ptr, looper_ptr);
}

#[cfg(target_os = "macos")]
unsafe fn release_native_overlay_objects_raw(layer_ptr: usize, player_ptr: usize, looper_ptr: usize) {
    if layer_ptr != 0 {
        let layer = &*(layer_ptr as *mut AVPlayerLayer);
        layer.removeFromSuperlayer();
        drop(Retained::from_raw(layer_ptr as *mut AVPlayerLayer));
    }

    if looper_ptr != 0 {
        let looper = &*(looper_ptr as *mut AVPlayerLooper);
        looper.disableLooping();
        drop(Retained::from_raw(looper_ptr as *mut AVPlayerLooper));
    }

    if player_ptr != 0 {
        let player = &*(player_ptr as *mut AVQueuePlayer);
        player.pause();
        player.removeAllItems();
        drop(Retained::from_raw(player_ptr as *mut AVQueuePlayer));
    }
}

#[cfg(target_os = "macos")]
unsafe fn release_intro_layer_raw(intro_layer_ptr: usize, intro_player_ptr: usize) {
    if intro_layer_ptr != 0 {
        let intro_layer = &*(intro_layer_ptr as *mut AVPlayerLayer);
        intro_layer.removeFromSuperlayer();
        drop(Retained::from_raw(intro_layer_ptr as *mut AVPlayerLayer));
    }
    if intro_player_ptr != 0 {
        let intro_player = &*(intro_player_ptr as *mut AVQueuePlayer);
        intro_player.pause();
        intro_player.removeAllItems();
        drop(Retained::from_raw(intro_player_ptr as *mut AVQueuePlayer));
    }
}

#[cfg(target_os = "macos")]
unsafe fn replace_native_overlay_objects(
    app: &tauri::AppHandle,
    layer: Retained<AVPlayerLayer>,
    player: Retained<AVQueuePlayer>,
    looper: Option<Retained<AVPlayerLooper>>,
) {
    let state = app.state::<AppState>();
    let mut overlay = state.native_overlay.lock().expect("native overlay mutex poisoned");
    let old_layer_ptr = overlay.layer_ptr;
    let old_player_ptr = overlay.player_ptr;
    let old_looper_ptr = overlay.looper_ptr;
    let old_intro_layer_ptr = overlay.intro_layer_ptr;
    let old_intro_player_ptr = overlay.intro_player_ptr;
    overlay.layer_ptr = Retained::into_raw(layer) as *mut AnyObject as usize;
    overlay.player_ptr = Retained::into_raw(player) as *mut AnyObject as usize;
    overlay.looper_ptr = looper
        .map(|value| Retained::into_raw(value) as *mut AnyObject as usize)
        .unwrap_or(0);
    overlay.intro_layer_ptr = 0;
    overlay.intro_player_ptr = 0;
    drop(overlay);
    release_intro_layer_raw(old_intro_layer_ptr, old_intro_player_ptr);
    release_native_overlay_objects_raw(old_layer_ptr, old_player_ptr, old_looper_ptr);
}

#[cfg(target_os = "macos")]
unsafe fn replace_native_overlay_dual_objects(
    app: &tauri::AppHandle,
    intro_layer: Retained<AVPlayerLayer>,
    intro_player: Retained<AVQueuePlayer>,
    loop_layer: Retained<AVPlayerLayer>,
    loop_player: Retained<AVQueuePlayer>,
    loop_looper: Retained<AVPlayerLooper>,
) {
    let state = app.state::<AppState>();
    let mut overlay = state
        .native_overlay
        .lock()
        .expect("native overlay mutex poisoned");
    let old_layer_ptr = overlay.layer_ptr;
    let old_player_ptr = overlay.player_ptr;
    let old_looper_ptr = overlay.looper_ptr;
    let old_intro_layer_ptr = overlay.intro_layer_ptr;
    let old_intro_player_ptr = overlay.intro_player_ptr;
    overlay.layer_ptr = Retained::into_raw(loop_layer) as *mut AnyObject as usize;
    overlay.player_ptr = Retained::into_raw(loop_player) as *mut AnyObject as usize;
    overlay.looper_ptr = Retained::into_raw(loop_looper) as *mut AnyObject as usize;
    overlay.intro_layer_ptr = Retained::into_raw(intro_layer) as *mut AnyObject as usize;
    overlay.intro_player_ptr = Retained::into_raw(intro_player) as *mut AnyObject as usize;
    drop(overlay);
    release_intro_layer_raw(old_intro_layer_ptr, old_intro_player_ptr);
    release_native_overlay_objects_raw(old_layer_ptr, old_player_ptr, old_looper_ptr);
}
