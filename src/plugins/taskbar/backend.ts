import type { TASKBAR_APPEARANCE as CTASKBAR_APPEARANCE, ITaskbarCofniguration } from 'common/electron-common/taskbar'
import { START_APPEARANCE } from 'common/electron-common/taskbar'
import type { TASKBAR_APPEARANCE } from 'win-func-tools'
import { SetTaskbar } from 'win-func-tools'
import { isNil, isNull, withMinAndMax, withT1AsT2 } from 'common/electron-common/types'
import applicationLogger from 'common/electron-common/applicationLogger'
import { Service } from 'common/electron-common'
import { Emitter, Event } from 'common/electron-common/base/event'
import type { EventPreloadType } from 'common/electron-common/windows'
import { WINDOW_MESSAGE_TYPE } from 'common/electron-common/windows'
import type { IDestroyable } from 'electron-main/common/lifecycle'
import { TimerHelper } from 'electron-main/common/timer'
import type { IBackendPlugin, IPluginContext } from 'common/electron-common/plugin'
export type { TASKBAR_APPEARANCE, ACCENT, TaskbarState } from 'win-func-tools'

const DEFAULT_CONFIGURATION: ITaskbarCofniguration = {
  enabled: false,
  style: START_APPEARANCE,
}

export function validateTaskbarStyle(style: TASKBAR_APPEARANCE) {
  if (isNil(style) || typeof style !== 'object')
    return false

  if (typeof style.ACCENT !== 'number')
    return false

  if (typeof style.COLOR !== 'number')
    return false

  if (!withMinAndMax(style.COLOR, 0x0, 0xFFFFFFFF))
    return false

  return true
}

export default class Taskbar implements IDestroyable, IBackendPlugin {
  private readonly channelName = 'lm:taskbar'

  private configuration!: ITaskbarCofniguration

  private appearance!: TASKBAR_APPEARANCE

  private readonly serivce = new Service()

  private readonly taskbarDbnamespace = this.context.core.getNameSpace(
    this.channelName,
  )

  private readonly _onTaskbarStyleChange = new Emitter<TASKBAR_APPEARANCE>()

  readonly onTaskbarStyleChange = this._onTaskbarStyleChange.event

  private timer: TimerHelper.PausableIntervalTimer | null = null

  constructor(
    private context: IPluginContext,
  ) {
  }

  destroy(): void {
    throw new Error('Method not implemented.')
  }

  onReady() {
    this.initalize()

    this.context.core.registerService(this.channelName, this.serivce)
  }

  async initDatabase() {
    const database = await this.taskbarDbnamespace.get('configuration')

    if (!database) {
      await this.taskbarDbnamespace.put({
        _id: 'configuration',
        data: DEFAULT_CONFIGURATION,
      })
    }

    const configuration
      = (await this.taskbarDbnamespace.get<ITaskbarCofniguration>(
        'configuration',
      ))!

    this.configuration = configuration.data
    this.appearance = withT1AsT2<TASKBAR_APPEARANCE>(
      this.configuration.style,
    )
  }

  async initalize() {
    await this.initDatabase()

    const taskbar = this.configuration

    const validate = validateTaskbarStyle(
      withT1AsT2<TASKBAR_APPEARANCE>(taskbar.style),
    )

    if (validate)
      this.appearance = withT1AsT2<TASKBAR_APPEARANCE>(taskbar.style)

    if (taskbar.enabled)
      this.setTaskbarStyle()

    this.registerListener()
  }

  registerListener() {
    this.onTaskbarStyleChange((e) => {
      this.setConfiguration({
        enabled: true,
        style: withT1AsT2<CTASKBAR_APPEARANCE>(e),
      })
    })

    this.serivce.registerCaller(
      WINDOW_MESSAGE_TYPE.IPC_CALL,
      async(preload: EventPreloadType) => {
        return await this.dispatchCallerMessage(preload)
      },
    )

    this.serivce.registerListener(
      WINDOW_MESSAGE_TYPE.IPC_LISTEN,
      (preload: EventPreloadType) => {
        return this.dispatchListenerMessage(preload)
      },
    )
  }

  private async dispatchCallerMessage(preload: EventPreloadType) {
    switch (preload.event) {
      case 'style': {
        if (!preload.arg)
          return this.appearance
        this.setTaskbarStyle(preload.arg)
        return true
      }

      default:
        return false
    }
  }

  private dispatchListenerMessage(preload: EventPreloadType) {
    switch (preload.event) {
      case 'style': {
        return this.onTaskbarStyleChange
      }

      default:
        return Event.None
    }
  }

  isEnable() {
    return !!this.timer
  }

  setTaskbarStyle(appearance?: TASKBAR_APPEARANCE) {
    if (appearance) {
      this.appearance = appearance
      this._onTaskbarStyleChange.fire(appearance)
    }

    if (isNull(this.timer)) {
      this.timer = new TimerHelper.PausableIntervalTimer(16 * 2, () => {
        this.setTaskbarStyle()
      })
    }
    else {
      this.timer?.restore()
    }

    SetTaskbar(this.appearance)
  }

  restoreTaskbarStyle() {
    if (this.timer)
      this.timer.pause()

    this.appearance = withT1AsT2<TASKBAR_APPEARANCE>(START_APPEARANCE)

    try {
      SetTaskbar(this.appearance)
    }
    catch (err) {
      console.error(err)
      applicationLogger.error(err)
    }
  }

  setConfiguration(configuration: ITaskbarCofniguration) {
    this.configuration = configuration

    this.taskbarDbnamespace.put({
      _id: 'configuration',
      data: configuration,
    })
  }

  getConfiguration() {
    return this.configuration
  }

  onDestroy(): void {
    if (this.timer)
      this.timer.dispose()

    this._onTaskbarStyleChange.dispose()

    this.restoreTaskbarStyle()
  }
}
