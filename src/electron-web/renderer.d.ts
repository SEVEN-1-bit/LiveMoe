import { LiveMoe } from 'livemoe';

declare global {
  // 注入 livemoe API
  var livemoe: {
    dbService: LiveMoe.DbService;
    windowsService: LiveMoe.WindowsService;
    wallpaperPlayerService: LiveMoe.WallpaperPlayerService;
    applicationService: LiveMoe.ApplicationService;
    taskbarService: LiveMoe.TaskbarService;
    trayService: LiveMoe.TrayService;
    serverService: LiveMoe.RendererService;
    platform: LiveMoe.Platform;
    guiService: LiveMoe.GuiService;
    wallpaperService: LiveMoe.WallpaperService;
    updateService: LiveMoe.UpdateService;
    dev: () => boolean;
    production: () => boolean;
  };

  var helper: {
    whenLiveMoeReady(): Promise<void>;
  };
}
