import type { IEventListener, IListener } from '@livemoe/ipc';
import type { IApplicationConfiguration } from 'common/electron-common/application';
import type { Event } from '@livemoe/utils';
import type { DatabaseNamespace, Doc } from 'common/electron-common/database';
import type { TASKBAR_APPEARANCE } from 'common/electron-common/taskbar';
import type { IWallpaperConfiguration, IWallpaperConfigurationFile, IWallpaperPlayerMode, IWallpaperPlayerPlayListChangeEvent, IWallpaperPlayProgress, PlayerRuntimeConfiguration } from 'common/electron-common/wallpaperPlayer';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';

declare namespace LiveMoe {
  interface DbService {
    getNamespace(name: string): Promise<DatabaseNamespace>;
  }

  interface UpdateService {
    checkForUpdate(): Promise<boolean>;
    update(): Promise<boolean>;

    onCheckForUpdate(): Promise<Event<void>>;
    onUpdateAvailable(): Promise<Event<UpdateInfo>>;
    onUpdateNotAvailable(): Promise<Event<UpdateInfo>>;
    onDownloadProgress(): Promise<Event<ProgressInfo>>;
    onUpdateDownloaded(): Promise<Event<UpdateInfo>>;
    onUpdateCheckError(): Promise<Event<Error>>;
  }

  interface WindowsService {
    refresh(windowId: string): Promise<void>;

    toggleWindow(windowId: string): Promise<any>;
    addEventListener(eventName: string, windowId: string): Promise<Event<any>>;
    sendWindowMessage(
      windowId: string,
      eventName: string,
      ...args: any[]
    ): Promise<any>;
  }

  interface WallpaperPlayerService {
    getPlayList(): Promise<IWallpaperConfiguration[]>;
    getConfiguration(): Promise<PlayerRuntimeConfiguration>;
    setConfiguration(configuration: PlayerRuntimeConfiguration): Promise<PlayerRuntimeConfiguration>;

    play(configuration?: IWallpaperConfiguration): Promise<boolean>;
    pause(): Promise<boolean>;
    prev(): Promise<boolean>;
    next(): Promise<boolean>;
    disable(): Promise<boolean>;
    enable(): Promise<boolean>;
    mute(): Promise<boolean>;
    sound(): Promise<boolean>;
    seek(value: number): Promise<boolean>;
    volume(value: number): Promise<boolean>;
    toggle(): Promise<boolean>;
    mode(mode: IWallpaperPlayerMode): Promise<boolean>;

    onPlay(): Promise<Event<any>>;
    onConfigChange(): Promise<Event<PlayerRuntimeConfiguration>>;
    onProgress(): Promise<Event<IWallpaperPlayProgress>>;
    onPlaylistChange(): Promise<Event<IWallpaperPlayerPlayListChangeEvent>>;
  }

  interface WallpaperService {
    createVideoWallpaper(configuration: IWallpaperConfigurationFile): Promise<boolean>;
    createImageWallpaper(configuration: IWallpaperConfigurationFile): Promise<boolean>;
    createHtmlWallpaper(configuration: IWallpaperConfigurationFile): Promise<boolean>;

    changeRepository(): Promise<boolean>;

    deleteWallpaper(configuration: IWallpaperConfiguration): Promise<boolean>;

    onChangeRepositoryBefore(): Promise<Event<void>>;
    onChangeRepositoryAfter(): Promise<Event<void>>;
    onMoveRepositoryBefore(): Promise<Event<void>>;
    onMoveRepositoryAfter(): Promise<Event<void>>;
    onCreateStart(): Promise<Event<void>>;
    onCreateEnd(): Promise<Event<void>>;
  }
  interface ApplicationService {
    getConfiguration(): Promise<IApplicationConfiguration>;
    setConfiguration(configuration: IApplicationConfiguration): Promise<any>;

    onConfigChange(): Promise<Event<IApplicationConfiguration>>;
    quit(): Promise<any>;
  }

  interface TaskbarService {
    setTaskbar(appearance: TASKBAR_APPEARANCE): Promise<any>;
    getTaskbar(): Promise<TASKBAR_APPEARANCE>;
    onStyleChange(): Promise<Event<any>>;
  }

  interface TrayService {
    hide(): Promise<any>;
    onShow(): Promise<Event<Electron.Rectangle>>;
    onHide(): Promise<Event<any>>;
    setIgnoreMouseEvents(ignore: boolean): Promise<any>;
  }

  interface Platform {
    windows(): boolean;
    macos(): boolean;
    linux(): boolean;
  }

  interface GuiService {
    openFolder(path: string): Promise<boolean>;

    openFileSelectDialog(options?: Electron.OpenDialogSyncOptions): Promise<string[] | undefined>;

    checkFileExists(path: string): Promise<boolean>;
  }

  interface ServerService {
    addCallerHandler: <T>(event: string, handler: IListener<T>) => void;
    addEventHandler: <T>(event: string, handler: IEventListener<T>) => void;
    removeEventHandler: (event: string) => void;
    removeCallerHandler: (event: string) => void;
  }

  interface WrapperService {
    sendMessage(eventName: string, ...args: any[]): Promise<any>;
    listeMessage(eventName: string, ...args: any[]): Promise<Event<any>>;
  }

  interface RendererService {
    createServerService(channelName: string): ServerService;

    getServerService(channelName: string): Promise<WrapperService | null>;
  }
}
