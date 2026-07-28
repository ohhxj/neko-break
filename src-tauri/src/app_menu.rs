use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::{AppHandle, Wry};

pub fn install_chinese_app_menu(app: &AppHandle<Wry>) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        let app_name = app
            .config()
            .product_name
            .clone()
            .unwrap_or_else(|| "Neko Break".to_string());

        let app_menu = SubmenuBuilder::new(app, &app_name)
            .about_with_text(format!("关于 {app_name}"), None)
            .separator()
            .services_with_text("服务")
            .separator()
            .hide_with_text(format!("隐藏 {app_name}"))
            .hide_others_with_text("隐藏其他应用")
            .show_all_with_text("全部显示")
            .separator()
            .quit_with_text(format!("退出 {app_name}"))
            .build()?;

        let file_menu = SubmenuBuilder::new(app, "文件")
            .close_window_with_text("关闭窗口")
            .build()?;

        let edit_menu = SubmenuBuilder::new(app, "编辑")
            .undo_with_text("撤销")
            .redo_with_text("重做")
            .separator()
            .cut_with_text("剪切")
            .copy_with_text("复制")
            .paste_with_text("粘贴")
            .select_all_with_text("全选")
            .build()?;

        let view_menu = SubmenuBuilder::new(app, "显示")
            .fullscreen_with_text("进入全屏")
            .build()?;

        let window_menu = SubmenuBuilder::new(app, "窗口")
            .minimize_with_text("最小化")
            .maximize_with_text("缩放")
            .build()?;

        let menu = MenuBuilder::new(app)
            .item(&app_menu)
            .item(&file_menu)
            .item(&edit_menu)
            .item(&view_menu)
            .item(&window_menu)
            .build()?;

        app.set_menu(menu)?;
    }

    #[cfg(not(target_os = "macos"))]
    let _ = app;

    Ok(())
}
