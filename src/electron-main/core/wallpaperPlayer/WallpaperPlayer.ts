import { type Display, globalShortcut, ipcMain, screen } from 'electron'
import { Emitter, Event, debounce } from '@livemoe/utils'
import type { IWallpaperPlayerPlayListChangeEvent } from 'common/electron-common/wallpaperPlayer'
import { DEFAULT_CONFIGURATION, DEFAULT_PLAY_RUNTIME_CONFIGURATION, type IWallpaperConfiguration, type IWallpaperPlayProgress, type IWallpaperPlayerConfiguration, type IWallpaperPlayerMode, type PlayerRuntimeConfiguration } from 'common/electron-common/wallpaperPlayer'
import type { IPCMainServer } from '@livemoe/ipc/main'
import { type IWallpaperFailLoadEvent, type IWallpaperPlayer, validateWallpaperConfiguration } from 'electron-main/common/wallpaperPlayer'
import WallpaperPlayerWindow from 'electron-main/windows/WallpaperPlayerWindow'
import { dev, win } from 'common/electron-common/environment'
import { screenWatcher } from 'electron-main/observables/screen.observable'
import type { IWallpaperPlayerAudioChangeEvent, IWallpaperPlayerDisabledChangeEvent, IWallpaperPlayerVolumeChangeEvent } from 'common/electron-common/wallpaperPlayerWindow'
import { lockScreenWatcher, unLockScreenWatcher } from 'electron-main/observables/power.observable'
import type Application from 'electron-main/Application'
import { type EventPreloadType, WINDOW_MESSAGE_TYPE } from 'common/electron-common/windows'
import { IPCService as Service } from '@livemoe/ipc'
import type { DocRes } from 'common/electron-common/database'
import { reactive } from 'common/electron-common/reactive'
import { QueryUserState } from 'electron-main/observables/user.observable'
import type { IWallpaperChangeEvent } from 'common/electron-common/wallpaperLoader'
import { isNil } from 'common/electron-common/types'

export default class WallpaperPlayer implements IWallpaperPlayer {
  private readonly channelName = 'lm:wallpaper:player'

  private readonly namespace = 'lm:wallpaper-player'

  private readonly dbNamespace = this.application.context.core.getNameSpace(
    this.namespace,
  )

  private configuration!: IWallpaperPlayerConfiguration

  private rtConfiguration!: PlayerRuntimeConfiguration

  private electronScreen: Display | null = null

  private isLocked = false

  private backgroundPause = false

  private isReady = false

  private defaultDisabled = false

  private window!: WallpaperPlayerWindow

  private cancelPauseToken: (() => void) | null = null

  private playlist: IWallpaperConfiguration[] = []

  private moveRepositoryDisabled = false

  private readonly service = new Service()

  private readonly readyEmitter = new Emitter<void>()

  private readonly playEmitter = new Emitter<IWallpaperConfiguration>()

  private readonly pauseEmitter = new Emitter<void>()

  private readonly progressEmitter = new Emitter<IWallpaperPlayProgress>()

  private readonly endedEmitter = new Emitter<void>()

  private readonly volumeEmitter
    = new Emitter<IWallpaperPlayerVolumeChangeEvent>()

  private readonly onAudioMuteChangeEmitter
    = new Emitter<IWallpaperPlayerAudioChangeEvent>()

  private readonly onDisableChangeEmitter
    = new Emitter<IWallpaperPlayerDisabledChangeEvent>()

  private readonly didLoadFailEmitter = new Emitter<IWallpaperFailLoadEvent>()

  private readonly didLoadFinshEmiiter = new Emitter<void>()

  private readonly closeEmitter = new Emitter<void>()

  private readonly destroyEmitter = new Emitter<void>()

  private readonly onPlayListChangeEmitter = new Emitter<IWallpaperPlayerPlayListChangeEvent>()

  private readonly onViewMode = Event.fromNodeEventEmitter(
    ipcMain,
    'lm:wallpaper:viewMode',
    (_event, x: number, y: number) => ({
      x,
      y,
    }),
  )

  readonly onReady = this.readyEmitter.event

  readonly onPlayChanged = this.playEmitter.event

  readonly onPaused = this.pauseEmitter.event

  readonly onProgress = this.progressEmitter.event

  readonly onDidLoadFail = this.didLoadFailEmitter.event

  readonly onDidLoadFinsh = this.didLoadFinshEmiiter.event

  readonly onDisableChange = this.onDisableChangeEmitter.event

  readonly onVolumeChange = this.volumeEmitter.event

  readonly onAudioMuteChange = this.onAudioMuteChangeEmitter.event

  readonly onEnded = this.endedEmitter.event

  readonly onClosed = this.closeEmitter.event

  readonly onDestroy = this.destroyEmitter.event

  readonly onPlayListChange = this.onPlayListChangeEmitter.event

  constructor(
    private readonly application: Application,
    private readonly server: IPCMainServer,
  ) {}

  async initalize() {
    await this.initDatabase()

    this.registerListener()

    // ????????????
    this.initalizeService()
  }

  private async initDatabase() {
    // ??????????????????
    let configuration = await this.dbNamespace.get('configuration')

    /**
     * ??????????????????????????????????????????????????????
     * ????????????????????????, ???????????????????????????????????????????????????, ???????????????????????????????????????????????????
     * , ?????????????????????????????????????????????, ????????????????????????????????????????????????
     */
    let rtConfiguration = await this.dbNamespace.get('rt-Configuration')
    if (rtConfiguration) {
      await this.dbNamespace.put({
        _id: 'rt-configuration',
        data: DEFAULT_PLAY_RUNTIME_CONFIGURATION,
        _rev: rtConfiguration._rev,
      })
    }
    else {
      rtConfiguration = (await this.dbNamespace.put({
        _id: 'rt-configuration',
        data: DEFAULT_PLAY_RUNTIME_CONFIGURATION,
      })) as DocRes
    }

    this.rtConfiguration = DEFAULT_PLAY_RUNTIME_CONFIGURATION

    if (!configuration) {
      await this.dbNamespace.put({
        _id: 'configuration',
        data: DEFAULT_CONFIGURATION,
      })
    }

    configuration = (await this.dbNamespace.get('configuration'))!

    this.configuration = configuration.data
    this.rtConfiguration.mute = this.configuration.mute
    this.rtConfiguration.volume = this.configuration.volume
    this.rtConfiguration.mode = this.configuration.mode
    this.rtConfiguration.disabled = this.configuration.disabled
    this.rtConfiguration.userSettings = this.configuration.userSettings
    this.rtConfiguration.viewMode = this.configuration.viewMode
    this.rtConfiguration.wallpaperConfiguration
      = this.configuration.wallpaper.configuration

    this.rtConfiguration = reactive(this.rtConfiguration, {
      set: (target, key, value) => {
        Reflect.set(target, key, value)
        this.updateRuntimeConfiguration()
        this.handleUpdateConfiguration(key, value)

        return true
      },
    })
  }

  private handleUpdateConfiguration(key: string | symbol, value: any) {
    switch (key) {
      case 'mute':
        this.configuration.mute = value
        break
      case 'volume':
        this.configuration.volume = value
        break
      case 'mode':
        this.configuration.mode = value
        break
      case 'disabled':
        this.configuration.disabled = value
        break
      case 'viewMode':
        this.configuration.viewMode = value
        break
      case 'userSettings':
        this.configuration.userSettings = value
        break
      case 'wallpaperConfiguration':
        this.configuration.wallpaper = {
          ...this.configuration.wallpaper,
          configuration: this.rtConfiguration.wallpaperConfiguration,
        }
        break
      default:
        break
    }

    this.updatePersistentConfiguration()
  }

  private updatePersistentConfiguration() {
    this.dbNamespace
      .get('configuration')
      .then((res) => {
        this.dbNamespace.put({
          _id: 'configuration',
          data: this.configuration,
          _rev: res?._rev,
        })
      })
      .catch(err => console.error(err))
  }

  private async updateRuntimeConfiguration() {
    // TODO: ??????????????????????????????????????????????????????EventEmitter, ??????????????????
    this.dbNamespace
      .get('rt-configuration')
      .then(async(rtConfiguration) => {
        await this.dbNamespace.put({
          _id: 'rt-configuration',
          data: this.rtConfiguration,
          _rev: rtConfiguration?._rev,
        })
      })
      .catch(err => console.error(err))
  }

  private async dispatchCallerWindowMessage(preload: EventPreloadType) {
    await this.whenReady()

    switch (preload.event) {
      case 'mute':
        this.mute()
        return true
      case 'sound':
        this.sound()
        return true
      case 'next':
        this.next()
        return true
      case 'prev':
        this.prev()
        return true
      case 'pause':
        this.pause()
        return true
      case 'play':
        if (typeof preload.arg === 'object' && preload.arg)
          this.play(preload.arg)
        else
          this.play()
        return true
      case 'disable':
        this.disable()
        return true
      case 'enable':
        this.enable()
        return true
      case 'volume':
        if (typeof preload.arg === 'number') {
          this.window.setVolume(preload.arg)
          return true
        }

        return false
      case 'seek':
        if (typeof preload.arg === 'number') {
          this.window.seek(preload.arg)
          return true
        }

        return false
      case 'toggle':
        if (this.rtConfiguration.status === 'playing')
          this.pause()
        else
          this.play()

        return true
      case 'playlist':
        return this.playlist

      case 'mode':
        if (typeof preload.arg === 'string')
          this.mode(preload.arg as IWallpaperPlayerMode)

        return true

      case 'configuration': {
        if (typeof preload.arg === 'object') {
          // TODO: ?????????
          this.rtConfiguration = reactive(preload.arg, {
            set: (target, key, value) => {
              Reflect.set(target, key, value)
              this.updateRuntimeConfiguration()
              this.handleUpdateConfiguration(key, value)

              return true
            },
          })

          this.configuration.disabled = this.rtConfiguration.disabled
          this.configuration.mute = this.rtConfiguration.mute
          this.configuration.volume = this.rtConfiguration.volume
          this.configuration.mode = this.rtConfiguration.mode
          this.configuration.userSettings = this.rtConfiguration.userSettings
          this.configuration.viewMode = this.rtConfiguration.viewMode
          this.configuration.wallpaper = {
            ...this.configuration.wallpaper,
            configuration: this.rtConfiguration.wallpaperConfiguration,
          }

          this.updateRuntimeConfiguration()
          this.updatePersistentConfiguration()
          return true
        }

        return this.rtConfiguration
      }
      default:
        return false
    }
  }

  private dispatchListenWindowMessage(preload: EventPreloadType) {
    switch (preload.event) {
      case 'play':
        return this.onPlayChanged
      case 'mute':
        return this.onAudioMuteChange
      case 'sound':
        return this.onAudioMuteChange
      case 'next':
        return this.onPlayChanged
      case 'prev':
        return this.onPlayChanged
      case 'pause':
        return this.onPaused
      case 'disable':
        return this.onDisableChange
      case 'progress':
        return this.onProgress
      case 'configuration': {
        return Event.map(
          Event.filter(this.dbNamespace.changes(), (change) => {
            return change.id === 'rt-configuration'
          }),
          (change) => {
            if (change.doc)
              return Reflect.get(change.doc, 'data')

            return null
          },
        )
      }
      case 'playlist':
        return this.onPlayListChange
      default:
        return Event.None
    }
  }

  private async registerListener() {
    if (!this.electronScreen)
      this.electronScreen = screen.getPrimaryDisplay()

    const { context } = this.application

    context.lifecycle.onReady(() => {
      this.moveRepositoryDisabled = false

      const onMoveRepositoryBefore = context.sendListenWindowMessage('lm:wallpaper', 'move:repository:before')

      onMoveRepositoryBefore(() => {
        if (!this.isDisabled()) {
          this.disable()
          this.window.release()
          this.moveRepositoryDisabled = true
        }
      })
    })

    screenWatcher((e) => {
      this.electronScreen = e.display
    })

    QueryUserState((userState) => {
      if (
        userState
        && this.rtConfiguration.userSettings.background === 'pause'
        && !this.cancelPauseToken
        && !this.rtConfiguration.disabled
      ) {
        this.pause()
        this.backgroundPause = true
      }
      else if (this.backgroundPause && !userState) {
        this.play()
        this.backgroundPause = false
      }
    })

    unLockScreenWatcher(() => {
      this.isLocked = false
      this.enable()
    })

    lockScreenWatcher(() => {
      this.isLocked = true
      // ??????????????????????????????, ????????????????????????, ????????????????????????DWN????????????
      this.disable()
    })

    this.onReady(() => {
      this.isReady = true

      this.handleReady()
    })

    this.onPlayListChange((event) => {
      switch (event.type) {
        case 'added':
          if (!Array.isArray(event.configuration)) {
            this.playlist.push(event.configuration!)
            this.window.addWallpaper2Playlist(event.configuration!)
          }
          break
        case 'deleted': {
          const index = this.playlist.findIndex(configuration => configuration.id === event.id)
          if (index !== -1)
            this.playlist.splice(index, 1)
          this.window.removeWallpaperFromPlaylist(event.id!)
        }
          break
        default:
          break
      }
    })

    // ??????????????????
    this.application.context.lifecycle.onBeforeLoad(() => {
      console.info('??????????????????????????????')
    })

    this.application.context.lifecycle.onLoad(() => {
      console.info('?????????????????????...')
    })

    // ????????????????????????
    this.application.context.lifecycle.onAfterLoad((wallpapers) => {
      this.playlist.push(...wallpapers)
      this.initWallpaperWindow()
    })
  }

  private handleReady() {
    this.window.onPlayRestore(() => {
      this.rtConfiguration.status = 'playing'
    })

    this.window.onPlayChange(
      debounce<(e: IWallpaperConfiguration) => void>((configuration) => {
        if (this.cancelPauseToken)
          this.cancelPauseToken()

        this.rtConfiguration.wallpaperConfiguration = configuration
        this.rtConfiguration.status = 'playing'

        const t = setTimeout(() => {
          clearTimeout(t)
          this.playEmitter.fire(configuration)
        })
      }, 100),
    )

    this.window.onPause(() => {
      this.rtConfiguration.status = 'paused'
    })

    this.window.onDisbaledChange(({ disabled }) => {
      this.rtConfiguration.disabled = disabled
    })

    this.window.onProgress((playingConfiguration) => {
      // TODO: ???????????????????????????????????????????????????, ??????????????????????????????, ???????????????????????????
      this.progressEmitter.fire({
        currentTime: playingConfiguration.nowTime,
        duration: playingConfiguration.totalTime,
      })
    })

    this.window.onEnded(() => {
      this.handleWallpaperEnded()

      this.endedEmitter.fire()
    })

    this.window.onAudioMuteChange(({ mute }) => {
      this.rtConfiguration.mute = mute
    })

    this.window.onVolumeChange(({ nVolume }) => {
      this.rtConfiguration.volume = nVolume
    })

    this.window.onModeChange((mode) => {
      this.rtConfiguration.mode = mode
    })

    this.onViewMode(
      debounce(({ x, y }: { x: number; y: number }) => {
        if (!this.rtConfiguration.viewVisible)
          return

        if (win()) {
          if (!this.electronScreen || !this.rtConfiguration.viewMode)
            return

          const windowTools = dev() ? require('win-func-tools') : __non_webpack_require__('win-func-tools')

          const { scaleFactor } = this.electronScreen

          const _x = scaleFactor * x
          const _y = scaleFactor * y

          const disabledArea = windowTools.GetSysListViewIconRect()

          for (let i = 0; i < disabledArea.length; i += 1) {
            const { left, right, bottom, top } = disabledArea[i]
            if (_x >= left && _x <= right && _y >= top && _y <= bottom)
              return
          }

          const visible = this.rtConfiguration.viewVisible

          if (visible) {
            windowTools.HideDesktopIcon()
            windowTools.HideShellWindow()
            this.rtConfiguration.viewVisible = false
          }
          else {
            windowTools.ShowShellWindow()
            windowTools.ShowDesktopIcon()
            this.rtConfiguration.viewVisible = true
          }
        }

        const result = globalShortcut.register('Ctrl+Shift+Q', () => {
          if (win()) {
            const windowTools = dev() ? require('win-func-tools') : __non_webpack_require__('win-func-tools')

            windowTools.ShowDesktopIcon()
            windowTools.ShowShellWindow()
          }

          this.rtConfiguration.viewVisible = true
          globalShortcut.unregister('Ctrl+Shift+Q')
        })

        if (!result)
          this.handleRegisterShortcutFailedWithViewMode()
      }, 200),
    )

    this.application.context.lifecycle.onChange((e) => {
      switch (e.type) {
        case 'added':
          this.handleAddedWallpaper(e)
          break
        case 'deleted':
          this.handleDeletedWallpaper(e)
          break
        case 'all':
          this.handlePatchAllWallpaper(e)
          break
        default:
          break
      }
    })
  }

  private async handlePatchAllWallpaper(e: IWallpaperChangeEvent) {
    if (Array.isArray(e.configuration)) {
      this.playlist = e.configuration
      this.window.setPlaylist(e.configuration)

      if (this.rtConfiguration.wallpaperConfiguration) {
        this.rtConfiguration.wallpaperConfiguration.resourcePath = this.rtConfiguration.wallpaperConfiguration.resourcePath.replace(this.rtConfiguration.wallpaperConfiguration.baseResourcePath, e.path)
        this.rtConfiguration.wallpaperConfiguration.playPath = this.rtConfiguration.wallpaperConfiguration.playPath.replace(this.rtConfiguration.wallpaperConfiguration.baseResourcePath, e.path)
        this.rtConfiguration.wallpaperConfiguration.baseResourcePath = e.path

        const config = this.playlist.find(configuration => configuration.playPath === this.rtConfiguration.wallpaperConfiguration!.playPath)

        if (config)
          this.rtConfiguration.wallpaperConfiguration = config

        if (this.isDisabled() && this.moveRepositoryDisabled)
          this.enable()

        setTimeout(() => this.play(this.rtConfiguration.wallpaperConfiguration!), 1000)
      }

      this.onPlayListChangeEmitter.fire({
        configuration: this.playlist,
        type: 'all',
      })
    }
  }

  private handleRegisterShortcutFailedWithViewMode() {
    if (win()) {
      const windowTools = dev() ? require('win-func-tools') : __non_webpack_require__('win-func-tools')

      windowTools.ShowDesktopIcon()
      windowTools.ShowShellWindow()
    }

    this.rtConfiguration.viewVisible = true
  }

  private handleAddedWallpaper(event: IWallpaperChangeEvent) {
    const { configuration } = event
    if (configuration && !Array.isArray(configuration)) {
      if (this.playlist.find(config => config.playPath === configuration.playPath))
        return

      this.onPlayListChangeEmitter.fire({
        type: 'added',
        configuration: configuration!,
      })
    }
  }

  private handleDeletedWallpaper(event: IWallpaperChangeEvent) {
    const { path: Path } = event

    const configuration = this.playlist.find((configuration) => {
      return configuration.resourcePath === Path
    })

    if (!configuration)
      return

    this.onPlayListChangeEmitter.fire({
      type: 'deleted',
      configuration: configuration!,
      id: configuration.id,
    })
  }

  handleWallpaperEnded() {
    switch (this.rtConfiguration.mode) {
      case 'single':
        break
      case 'list-loop':
        this.next()
        break
      case 'order':
        this.next()
        break
    }
  }

  private initalizeService() {
    this.server.registerChannel(this.channelName, this.service)

    this.application.registerEvent(this.channelName, (type, preload) => {
      switch (type) {
        case WINDOW_MESSAGE_TYPE.WINDOW_CALL:
          return this.dispatchCallerWindowMessage(preload)
        case WINDOW_MESSAGE_TYPE.WINDOW_LISTEN:
          return this.dispatchListenWindowMessage(preload)
        default:
          return Event.None
      }
    })

    this.service.registerCaller(
      WINDOW_MESSAGE_TYPE.IPC_CALL,
      async(preload: EventPreloadType) => {
        const result = await this.dispatchCallerWindowMessage(preload)

        return result
      },
    )

    this.service.registerListener(
      WINDOW_MESSAGE_TYPE.IPC_LISTEN,
      (preload: EventPreloadType) => {
        const result = this.dispatchListenWindowMessage(preload)

        return result
      },
    )
  }

  private async initWallpaperWindow() {
    console.info('wallpaper list: ', this.playlist.length)

    const configuration = this.rtConfiguration.wallpaperConfiguration

    if (!isNil(configuration)) {
      const playingConfiguration = this.playlist.find((configuration) => {
        return this.rtConfiguration.wallpaperConfiguration?.playPath === configuration.playPath || this.rtConfiguration.wallpaperConfiguration?.resourcePath === configuration.resourcePath
      })

      if (playingConfiguration) {
        this.rtConfiguration.wallpaperConfiguration = playingConfiguration
        this.configuration.wallpaper = {
          ...this.configuration.wallpaper,
          configuration: playingConfiguration,
        }
        this.updateRuntimeConfiguration()
        this.updatePersistentConfiguration()
      }
    }

    this.window = new WallpaperPlayerWindow(
      this.playlist,
      this.rtConfiguration,
    )

    this.readyEmitter.fire()

    this.window.setVolume(this.rtConfiguration.volume)
    this.window.setMute(this.rtConfiguration.mute)
    this.window.mode(this.rtConfiguration.mode)

    if (this.rtConfiguration.disabled) {
      if (
        configuration
        && Object.keys(configuration).length > 0
        && (await validateWallpaperConfiguration(configuration))
      )
        this.window.configuration = configuration!

      this.defaultDisabled = true
      return
    }

    if (!configuration || Object.keys(configuration).length <= 0)
      this.play()
    else if (
      configuration
      && (await validateWallpaperConfiguration(configuration))
    )
      this.play(configuration)
    else
      this.window.play(0)
  }

  private async whenReady() {
    if (this.isReady)
      return Promise.resolve()

    return Event.toPromise(this.onReady)
  }

  // #region ?????????????????????

  async play(): Promise<void>
  async play(wConfiguration: IWallpaperConfiguration): Promise<void>
  async play(argv?: IWallpaperConfiguration): Promise<void> {
    /**
     * ????????????????????????????????????
     * 1. ?????????????????????????????????, ???????????????????????????????????????, ????????????
     *  1.1 ????????????????????????, ?????????????????????????????? enable ??????????????????
     *  1.2 ????????????????????????????????????????????????
     * 2. ???????????????, ?????????????????????
     */
    if (this.isDisabled())
      return

    await this.whenReady()

    if (typeof argv === 'object')
      this.window.play(argv)
    else if (!this.cancelPauseToken)
      this.window.play()
    else
      this.cancelPauseToken()
  }

  async pause() {
    if (this.isDisabled())
      return

    await this.whenReady()

    const cancelToken = await this.window.pause()

    this.cancelPauseToken = () => {
      cancelToken()
      this.cancelPauseToken = null
    }

    this.pauseEmitter.fire()
  }

  async prev() {
    await this.whenReady()

    const configuration = await this.window.prev()
    if (configuration)
      this.window.play(configuration)
    else
      this.window.play()
  }

  async next() {
    await this.whenReady()

    const configuration = await this.window.next()
    if (configuration)
      this.window.play(configuration)
    else
      this.window.play()
  }

  async mute() {
    await this.whenReady()

    this.window.setMute(true)
  }

  async sound() {
    await this.whenReady()

    this.window.setMute(false)
  }

  async disable() {
    await this.whenReady()

    this.window.disable()
  }

  async enable() {
    await this.whenReady()

    this.window.enable()

    if (this.defaultDisabled) {
      this.window.play()
      this.defaultDisabled = false
    }
  }

  isDisabled() {
    return this.rtConfiguration.disabled
  }

  // mode
  async mode(mode: IWallpaperPlayerMode) {
    console.log('mode', mode)

    this.rtConfiguration.mode = mode

    this.window.mode(mode)
  }

  // #endregion

  destroy() {
    this.destroyEmitter.fire()

    process.nextTick(() => {
      this.readyEmitter.dispose()
      this.pauseEmitter.dispose()
      this.playEmitter.dispose()
      this.progressEmitter.dispose()
      this.endedEmitter.dispose()
      this.closeEmitter.dispose()
      this.destroyEmitter.dispose()
      this.onAudioMuteChangeEmitter.dispose()
      this.didLoadFailEmitter.dispose()
      this.didLoadFinshEmiiter.dispose()
      this.onDisableChangeEmitter.dispose()
      this.volumeEmitter.dispose()
      this.onPlayListChangeEmitter.dispose()

      /** ???????????????????????? */
      if (win()) {
        const windowTools = dev() ? require('win-func-tools') : __non_webpack_require__('win-func-tools')
        windowTools.RestoreWorkerW()
        windowTools.ShowDesktopIcon()
        windowTools.ShowShellWindow()
      }
    })
  }
}
