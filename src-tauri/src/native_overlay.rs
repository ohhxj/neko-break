#[cfg(target_os = "macos")]
use crate::{
    app_state::{AppState, NativeInteractionLayerState},
    commands::window::NativeOverlayMedia,
};
#[cfg(target_os = "macos")]
use objc2::{rc::Retained, runtime::AnyObject, MainThreadMarker};
#[cfg(target_os = "macos")]
use objc2_app_kit::{NSColor, NSWindow};
#[cfg(target_os = "macos")]
use objc2_av_foundation::{
    AVLayerVideoGravityResizeAspect, AVPlayerItem, AVPlayerLayer, AVPlayerLooper, AVQueuePlayer,
};
#[cfg(target_os = "macos")]
use objc2_core_media::CMTime;
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

    // 优先尝试原生多层模式：loop 必须是 mov_alpha，intro/outro 可选但给出时也必须是 mov_alpha。
    let native_sequence = media
        .loop_file_path
        .as_ref()
        .filter(|_| media.loop_format.as_deref() == Some("mov_alpha"))
        .and_then(|loop_path| {
            let intro = match (
                media.intro_file_path.as_ref(),
                media.intro_format.as_deref(),
            ) {
                (Some(path), Some("mov_alpha")) => {
                    Some((path.clone(), media.intro_duration_ms.unwrap_or(0)))
                }
                (None, _) => None,
                _ => return None,
            };
            let outro = match (
                media.outro_file_path.as_ref(),
                media.outro_format.as_deref(),
            ) {
                (Some(path), Some("mov_alpha")) => {
                    Some((path.clone(), media.outro_duration_ms.unwrap_or(0)))
                }
                (None, _) => None,
                _ => return None,
            };
            Some((intro, loop_path.clone(), outro))
        });

    if let Some((intro, loop_path, outro)) = native_sequence {
        let interactions = media
            .interactions
            .iter()
            .filter(|interaction| interaction.format == "mov_alpha")
            .map(|interaction| (interaction.id.clone(), interaction.file_path.clone()))
            .collect();
        return setup_native_sequence(app, window, intro, loop_path, outro, interactions);
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

    let generation = bump_native_overlay_generation(app);
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
        let player = if should_loop && !should_chain_into_loop {
            AVQueuePlayer::playerWithPlayerItem(None, mtm)
        } else {
            AVQueuePlayer::playerWithPlayerItem(Some(&initial_item), mtm)
        };
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
            Some(AVPlayerLooper::playerLooperWithPlayer_templateItem(
                &player, &loop_item,
            ))
        } else if should_loop {
            Some(AVPlayerLooper::playerLooperWithPlayer_templateItem(
                &player,
                &initial_item,
            ))
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
        replace_native_overlay_objects(&app_handle, generation, layer, player, looper);
    })
}

#[cfg(target_os = "macos")]
fn setup_native_sequence(
    app: &tauri::AppHandle,
    window: &WebviewWindow,
    intro: Option<(String, u64)>,
    loop_path: String,
    outro: Option<(String, u64)>,
    interactions: Vec<(String, String)>,
) -> tauri::Result<()> {
    let generation = bump_native_overlay_generation(app);
    let intro_duration_ms = intro.as_ref().map(|(_, duration)| *duration).unwrap_or(0);
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
        // 有入场层时 loop 先隐藏；没有入场时 loop 直接显示并播放。
        loop_layer.setOpacity(if intro.is_some() { 0.0 } else { 1.0 });

        // -- 入场层：单次播放 AVPlayer，可选 --
        let intro_objects = if let Some((intro_path, _)) = intro.as_ref() {
            let Some(intro_url) = NSURL::from_file_path(intro_path) else {
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
            intro_layer.setOpacity(1.0);
            Some((intro_layer, intro_player))
        } else {
            None
        };

        // -- 退场层：单次播放 AVPlayer，可选，默认隐藏 --
        let outro_objects = if let Some((outro_path, _)) = outro.as_ref() {
            let Some(outro_url) = NSURL::from_file_path(outro_path) else {
                return;
            };
            let outro_item = AVPlayerItem::playerItemWithURL(&outro_url, mtm);
            let outro_player = AVQueuePlayer::playerWithPlayerItem(Some(&outro_item), mtm);
            outro_player.setMuted(true);
            outro_player.setAllowsExternalPlayback(false);
            outro_player.setAutomaticallyWaitsToMinimizeStalling(false);

            let outro_layer = AVPlayerLayer::playerLayerWithPlayer(Some(&outro_player));
            if let Some(video_gravity) = AVLayerVideoGravityResizeAspect {
                outro_layer.setVideoGravity(video_gravity);
            }
            outro_layer.setOpaque(false);
            outro_layer.setNeedsDisplayOnBoundsChange(true);
            outro_layer.setAutoresizingMask(
                CAAutoresizingMask::LayerWidthSizable | CAAutoresizingMask::LayerHeightSizable,
            );
            outro_layer.setFrame(content_view.bounds());
            outro_layer.setOpacity(0.0);
            Some((outro_layer, outro_player))
        } else {
            None
        };

        // -- 互动层：随场景预挂载，默认隐藏。播放时等待首帧 ready 后再覆盖 loop。 --
        let interaction_objects = interactions
            .iter()
            .filter_map(|(id, file_path)| {
                let url = NSURL::from_file_path(file_path)?;
                let item = AVPlayerItem::playerItemWithURL(&url, mtm);
                let player = AVQueuePlayer::playerWithPlayerItem(Some(&item), mtm);
                player.setMuted(true);
                player.setAllowsExternalPlayback(false);
                player.setAutomaticallyWaitsToMinimizeStalling(false);

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
                layer.setOpacity(0.0);
                Some((id.clone(), file_path.clone(), layer, player))
            })
            .collect::<Vec<_>>();

        // 挂载：循环层在底，入场和退场层在上。退场层最后挂载，关闭时可覆盖 loop。
        content_view.setWantsLayer(true);
        if let Some(host_layer) = content_view.layer() {
            host_layer.setOpaque(false);
            host_layer.setBackgroundColor(None);
            host_layer.setMasksToBounds(false);
            host_layer.addSublayer(&loop_layer);
            if let Some((intro_layer, _)) = intro_objects.as_ref() {
                host_layer.addSublayer(intro_layer);
            }
            for (_, _, interaction_layer, _) in &interaction_objects {
                host_layer.addSublayer(interaction_layer);
            }
            if let Some((outro_layer, _)) = outro_objects.as_ref() {
                host_layer.addSublayer(outro_layer);
            }
        }

        if let Some((_, intro_player)) = intro_objects.as_ref() {
            intro_player.play();
        } else {
            loop_player.play();
        }

        replace_native_overlay_sequence_objects(
            &app_handle,
            generation,
            intro_objects,
            loop_layer,
            loop_player,
            loop_looper,
            outro_objects,
            interaction_objects,
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
                swap_intro_to_loop(&app_for_main, generation);
            });
        });
    }

    Ok(())
}

#[cfg(target_os = "macos")]
unsafe fn swap_intro_to_loop(app: &tauri::AppHandle, generation: u64) {
    let state = app.state::<AppState>();
    let overlay = state
        .native_overlay
        .lock()
        .expect("native overlay mutex poisoned");

    if overlay.generation != generation || overlay.outro_started {
        return;
    }

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

#[cfg(target_os = "macos")]
pub fn play_overlay_outro(app: &tauri::AppHandle) -> tauri::Result<()> {
    let app_handle = app.clone();
    app.run_on_main_thread(move || unsafe {
        swap_loop_to_outro(&app_handle);
    })
}

#[cfg(target_os = "macos")]
pub fn play_overlay_interaction(app: &tauri::AppHandle, interaction_id: &str) -> tauri::Result<()> {
    let request = {
        let state = app.state::<AppState>();
        let mut overlay = state
            .native_overlay
            .lock()
            .expect("native overlay mutex poisoned");
        overlay.interaction_request = overlay.interaction_request.wrapping_add(1);
        overlay.active_interaction_id = Some(interaction_id.to_owned());
        overlay.interaction_request
    };

    let app_handle = app.clone();
    let requested_id = interaction_id.to_owned();
    app.run_on_main_thread(move || unsafe {
        begin_overlay_interaction(&app_handle, &requested_id, request);
    })?;

    // AVPlayerLayer 在 readyForDisplay 之前没有可见内容。循环层保持显示，
    // 逐帧检查首帧就绪后再做同帧 opacity 翻转，避免透明窗口露底闪白。
    let app_for_ready = app.clone();
    tauri::async_runtime::spawn(async move {
        for _ in 0..120 {
            tokio::time::sleep(std::time::Duration::from_millis(16)).await;
            let app_for_main = app_for_ready.clone();
            let _ = app_for_ready.run_on_main_thread(move || unsafe {
                reveal_overlay_interaction_if_ready(&app_for_main, request);
            });
        }
    });

    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn play_overlay_interaction(
    _app: &tauri::AppHandle,
    _interaction_id: &str,
) -> tauri::Result<()> {
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn stop_overlay_interaction(app: &tauri::AppHandle) -> tauri::Result<()> {
    {
        let state = app.state::<AppState>();
        let mut overlay = state
            .native_overlay
            .lock()
            .expect("native overlay mutex poisoned");
        overlay.interaction_request = overlay.interaction_request.wrapping_add(1);
        overlay.active_interaction_id = None;
    }
    let app_handle = app.clone();
    app.run_on_main_thread(move || unsafe {
        hide_overlay_interaction(&app_handle);
    })
}

#[cfg(not(target_os = "macos"))]
pub fn stop_overlay_interaction(_app: &tauri::AppHandle) -> tauri::Result<()> {
    Ok(())
}

#[cfg(target_os = "macos")]
unsafe fn begin_overlay_interaction(app: &tauri::AppHandle, interaction_id: &str, request: u64) {
    let state = app.state::<AppState>();
    let overlay = state
        .native_overlay
        .lock()
        .expect("native overlay mutex poisoned");
    if overlay.interaction_request != request
        || overlay.active_interaction_id.as_deref() != Some(interaction_id)
        || overlay.outro_started
    {
        return;
    }

    for interaction in &overlay.interactions {
        let layer = &*(interaction.layer_ptr as *mut AVPlayerLayer);
        layer.setOpacity(0.0);
        let player = &*(interaction.player_ptr as *mut AVQueuePlayer);
        player.pause();
        if interaction.id == interaction_id {
            if player.currentItem().is_none() {
                let Some(mtm) = MainThreadMarker::new() else {
                    return;
                };
                let Some(url) = NSURL::from_file_path(&interaction.file_path) else {
                    return;
                };
                let item = AVPlayerItem::playerItemWithURL(&url, mtm);
                player.insertItem_afterItem(&item, None);
            }
            player.seekToTime(CMTime::new(0, 600));
            player.play();
        }
    }
}

#[cfg(target_os = "macos")]
unsafe fn reveal_overlay_interaction_if_ready(app: &tauri::AppHandle, request: u64) {
    let state = app.state::<AppState>();
    let overlay = state
        .native_overlay
        .lock()
        .expect("native overlay mutex poisoned");
    if overlay.interaction_request != request || overlay.outro_started {
        return;
    }
    let Some(active_id) = overlay.active_interaction_id.as_deref() else {
        return;
    };
    let Some(interaction) = overlay
        .interactions
        .iter()
        .find(|interaction| interaction.id == active_id)
    else {
        return;
    };
    let interaction_layer = &*(interaction.layer_ptr as *mut AVPlayerLayer);
    if !interaction_layer.isReadyForDisplay() {
        return;
    }
    if interaction_layer.opacity() > 0.0 {
        return;
    }

    CATransaction::begin();
    CATransaction::setDisableActions(true);
    if overlay.layer_ptr != 0 {
        let loop_layer = &*(overlay.layer_ptr as *mut AVPlayerLayer);
        loop_layer.setOpacity(0.0);
    }
    interaction_layer.setOpacity(1.0);
    CATransaction::commit();
}

#[cfg(target_os = "macos")]
unsafe fn hide_overlay_interaction(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let overlay = state
        .native_overlay
        .lock()
        .expect("native overlay mutex poisoned");

    CATransaction::begin();
    CATransaction::setDisableActions(true);
    if overlay.layer_ptr != 0 && !overlay.outro_started {
        let loop_layer = &*(overlay.layer_ptr as *mut AVPlayerLayer);
        loop_layer.setOpacity(1.0);
        if overlay.player_ptr != 0 {
            let loop_player = &*(overlay.player_ptr as *mut AVQueuePlayer);
            loop_player.play();
        }
    }
    for interaction in &overlay.interactions {
        let layer = &*(interaction.layer_ptr as *mut AVPlayerLayer);
        layer.setOpacity(0.0);
        let player = &*(interaction.player_ptr as *mut AVQueuePlayer);
        player.pause();
    }
    CATransaction::commit();
}

#[cfg(not(target_os = "macos"))]
pub fn play_overlay_outro(_app: &tauri::AppHandle) -> tauri::Result<()> {
    Ok(())
}

#[cfg(target_os = "macos")]
unsafe fn swap_loop_to_outro(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let mut overlay = state
        .native_overlay
        .lock()
        .expect("native overlay mutex poisoned");

    if overlay.outro_started || overlay.outro_layer_ptr == 0 || overlay.outro_player_ptr == 0 {
        return;
    }
    overlay.outro_started = true;

    CATransaction::begin();
    CATransaction::setDisableActions(true);

    if overlay.layer_ptr != 0 {
        let loop_layer = &*(overlay.layer_ptr as *mut AVPlayerLayer);
        loop_layer.setOpacity(0.0);
    }
    if overlay.player_ptr != 0 {
        let loop_player = &*(overlay.player_ptr as *mut AVQueuePlayer);
        loop_player.pause();
    }
    if overlay.intro_layer_ptr != 0 {
        let intro_layer = &*(overlay.intro_layer_ptr as *mut AVPlayerLayer);
        intro_layer.setOpacity(0.0);
    }

    let outro_layer = &*(overlay.outro_layer_ptr as *mut AVPlayerLayer);
    outro_layer.setOpacity(1.0);
    let outro_player = &*(overlay.outro_player_ptr as *mut AVQueuePlayer);
    outro_player.play();

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
fn bump_native_overlay_generation(app: &tauri::AppHandle) -> u64 {
    let state = app.state::<AppState>();
    let mut overlay = state
        .native_overlay
        .lock()
        .expect("native overlay mutex poisoned");
    overlay.generation = overlay.generation.wrapping_add(1);
    overlay.outro_started = false;
    overlay.generation
}

#[cfg(target_os = "macos")]
unsafe fn release_native_overlay_objects(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let mut overlay = state
        .native_overlay
        .lock()
        .expect("native overlay mutex poisoned");
    overlay.generation = overlay.generation.wrapping_add(1);
    let layer_ptr = overlay.layer_ptr;
    let player_ptr = overlay.player_ptr;
    let looper_ptr = overlay.looper_ptr;
    let intro_layer_ptr = overlay.intro_layer_ptr;
    let intro_player_ptr = overlay.intro_player_ptr;
    let outro_layer_ptr = overlay.outro_layer_ptr;
    let outro_player_ptr = overlay.outro_player_ptr;
    let interactions = std::mem::take(&mut overlay.interactions);
    overlay.layer_ptr = 0;
    overlay.player_ptr = 0;
    overlay.looper_ptr = 0;
    overlay.intro_layer_ptr = 0;
    overlay.intro_player_ptr = 0;
    overlay.outro_layer_ptr = 0;
    overlay.outro_player_ptr = 0;
    overlay.outro_started = false;
    overlay.active_interaction_id = None;
    overlay.interaction_request = overlay.interaction_request.wrapping_add(1);
    drop(overlay);

    release_intro_layer_raw(intro_layer_ptr, intro_player_ptr);
    release_intro_layer_raw(outro_layer_ptr, outro_player_ptr);
    release_native_overlay_objects_raw(layer_ptr, player_ptr, looper_ptr);
    release_interaction_layers(interactions);
}

#[cfg(target_os = "macos")]
unsafe fn release_native_overlay_objects_raw(
    layer_ptr: usize,
    player_ptr: usize,
    looper_ptr: usize,
) {
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
    generation: u64,
    layer: Retained<AVPlayerLayer>,
    player: Retained<AVQueuePlayer>,
    looper: Option<Retained<AVPlayerLooper>>,
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
    let old_outro_layer_ptr = overlay.outro_layer_ptr;
    let old_outro_player_ptr = overlay.outro_player_ptr;
    let old_interactions = std::mem::take(&mut overlay.interactions);
    overlay.generation = generation;
    overlay.layer_ptr = Retained::into_raw(layer) as *mut AnyObject as usize;
    overlay.player_ptr = Retained::into_raw(player) as *mut AnyObject as usize;
    overlay.looper_ptr = looper
        .map(|value| Retained::into_raw(value) as *mut AnyObject as usize)
        .unwrap_or(0);
    overlay.intro_layer_ptr = 0;
    overlay.intro_player_ptr = 0;
    overlay.outro_layer_ptr = 0;
    overlay.outro_player_ptr = 0;
    overlay.outro_started = false;
    overlay.active_interaction_id = None;
    overlay.interaction_request = overlay.interaction_request.wrapping_add(1);
    drop(overlay);
    release_intro_layer_raw(old_intro_layer_ptr, old_intro_player_ptr);
    release_intro_layer_raw(old_outro_layer_ptr, old_outro_player_ptr);
    release_native_overlay_objects_raw(old_layer_ptr, old_player_ptr, old_looper_ptr);
    release_interaction_layers(old_interactions);
}

#[cfg(target_os = "macos")]
unsafe fn replace_native_overlay_sequence_objects(
    app: &tauri::AppHandle,
    generation: u64,
    intro_objects: Option<(Retained<AVPlayerLayer>, Retained<AVQueuePlayer>)>,
    loop_layer: Retained<AVPlayerLayer>,
    loop_player: Retained<AVQueuePlayer>,
    loop_looper: Retained<AVPlayerLooper>,
    outro_objects: Option<(Retained<AVPlayerLayer>, Retained<AVQueuePlayer>)>,
    interaction_objects: Vec<(
        String,
        String,
        Retained<AVPlayerLayer>,
        Retained<AVQueuePlayer>,
    )>,
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
    let old_outro_layer_ptr = overlay.outro_layer_ptr;
    let old_outro_player_ptr = overlay.outro_player_ptr;
    let old_interactions = std::mem::take(&mut overlay.interactions);
    overlay.generation = generation;
    overlay.layer_ptr = Retained::into_raw(loop_layer) as *mut AnyObject as usize;
    overlay.player_ptr = Retained::into_raw(loop_player) as *mut AnyObject as usize;
    overlay.looper_ptr = Retained::into_raw(loop_looper) as *mut AnyObject as usize;
    let (intro_layer_ptr, intro_player_ptr) = intro_objects
        .map(|(layer, player)| {
            (
                Retained::into_raw(layer) as *mut AnyObject as usize,
                Retained::into_raw(player) as *mut AnyObject as usize,
            )
        })
        .unwrap_or((0, 0));
    let (outro_layer_ptr, outro_player_ptr) = outro_objects
        .map(|(layer, player)| {
            (
                Retained::into_raw(layer) as *mut AnyObject as usize,
                Retained::into_raw(player) as *mut AnyObject as usize,
            )
        })
        .unwrap_or((0, 0));
    overlay.intro_layer_ptr = intro_layer_ptr;
    overlay.intro_player_ptr = intro_player_ptr;
    overlay.outro_layer_ptr = outro_layer_ptr;
    overlay.outro_player_ptr = outro_player_ptr;
    overlay.outro_started = false;
    overlay.interactions = interaction_objects
        .into_iter()
        .map(
            |(id, file_path, layer, player)| NativeInteractionLayerState {
                file_path,
                id,
                layer_ptr: Retained::into_raw(layer) as *mut AnyObject as usize,
                player_ptr: Retained::into_raw(player) as *mut AnyObject as usize,
            },
        )
        .collect();
    overlay.active_interaction_id = None;
    overlay.interaction_request = overlay.interaction_request.wrapping_add(1);
    drop(overlay);
    release_intro_layer_raw(old_intro_layer_ptr, old_intro_player_ptr);
    release_intro_layer_raw(old_outro_layer_ptr, old_outro_player_ptr);
    release_native_overlay_objects_raw(old_layer_ptr, old_player_ptr, old_looper_ptr);
    release_interaction_layers(old_interactions);
}

#[cfg(target_os = "macos")]
unsafe fn release_interaction_layers(interactions: Vec<NativeInteractionLayerState>) {
    for interaction in interactions {
        if interaction.layer_ptr != 0 {
            let layer = &*(interaction.layer_ptr as *mut AVPlayerLayer);
            layer.removeFromSuperlayer();
            drop(Retained::from_raw(
                interaction.layer_ptr as *mut AVPlayerLayer,
            ));
        }
        if interaction.player_ptr != 0 {
            let player = &*(interaction.player_ptr as *mut AVQueuePlayer);
            player.pause();
            player.removeAllItems();
            drop(Retained::from_raw(
                interaction.player_ptr as *mut AVQueuePlayer,
            ));
        }
    }
}
