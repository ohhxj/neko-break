use std::path::{Path, PathBuf};
use tauri::{process::current_binary, Manager};
use tokio::fs;

const LAUNCH_AGENT_LABEL: &str = "com.reshui.mac-break-reminder";

fn launch_agent_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let home = app.path().home_dir().map_err(|error| error.to_string())?;
    Ok(home
        .join("Library")
        .join("LaunchAgents")
        .join(format!("{LAUNCH_AGENT_LABEL}.plist")))
}

fn plist_payload(executable_path: &Path) -> String {
    let executable = executable_path.display().to_string();
    let working_directory = executable_path
        .parent()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| "/".into());

    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{executable}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>WorkingDirectory</key>
  <string>{working_directory}</string>
</dict>
</plist>
"#
    )
}

pub async fn sync_launch_at_login(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let plist_path = launch_agent_path(app)?;

    if enabled {
        let executable =
            current_binary(&app.env()).map_err(|error| format!("resolve binary failed: {error}"))?;
        if let Some(parent) = plist_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|error| error.to_string())?;
        }
        fs::write(&plist_path, plist_payload(&executable))
            .await
            .map_err(|error| error.to_string())?;
    } else if fs::try_exists(&plist_path)
        .await
        .map_err(|error| error.to_string())?
    {
        fs::remove_file(&plist_path)
            .await
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}
