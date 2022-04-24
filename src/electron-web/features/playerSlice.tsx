import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { retry } from 'common/electron-common/utils'
import type {
  IWallpaperConfiguration,
  PlayRuntimeConfiguration,
} from 'common/electron-common/wallpaperPlayer'
import {
  DEFAULT_PLAY_RUNTIME_CONFIGURATION,
} from 'common/electron-common/wallpaperPlayer'
import type { rootStore } from 'electron-web/store/store'

/**
 * 维护播放器状态
 */
export interface PlayerStatus {
  status: 'pending' | 'play' | 'pause'; // 播放状态
  playProgress: number; // 0.0 ~ 1.0
}

export const initalizePlayerState = createAsyncThunk<{
  playList: IWallpaperConfiguration[]
  configuration: PlayRuntimeConfiguration
}>(
  'wallpaper-player-configuration/initalize',
  async() =>
    await retry(
      async() => {
        const configuration
          = await livemoe.wallpaperPlayerService.getConfiguration()
        const playList = await livemoe.wallpaperPlayerService.getPlayList()
        return {
          configuration,
          playList,
        }
      },
      3,
      50,
    ),
)

export const enum PlayerInitalizeState {
  INITIALIZING = 'INITIALIZING',
  LOADING = 'LOADING',
  UNINITIALIZING = 'UNINITLIZING',
}

export interface IPlayerStore {
  state: PlayerInitalizeState
  playList: IWallpaperConfiguration[]
  configuration: PlayRuntimeConfiguration
}

const initialState: IPlayerStore = {
  state: PlayerInitalizeState.UNINITIALIZING,
  playList: [],
  configuration: DEFAULT_PLAY_RUNTIME_CONFIGURATION,
}

const playerConfiguration = createSlice({
  name: 'wallpaper-player-configuration',
  initialState,
  reducers: {
    updateConfigurationAll: (state, action) => {
      state.configuration = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initalizePlayerState.pending, (state) => {
        console.log('加载壁纸播放器播放列表中...')
        state.state = PlayerInitalizeState.LOADING
      })
      .addCase(initalizePlayerState.fulfilled, (state, action) => {
        console.log('加载壁纸播放器播放列表中成功', state, action)
        state.state = PlayerInitalizeState.INITIALIZING
        state.playList = action.payload.playList
        state.configuration = action.payload.configuration
      })
      .addCase(initalizePlayerState.rejected, (state) => {
        console.log('尝试加载壁纸播放器播放列表中失败, 准备重试...')
        state.state = PlayerInitalizeState.UNINITIALIZING
      })
  },
})

export const { updateConfigurationAll } = playerConfiguration.actions

export const selectPlayerConfiguration = (state: rootStore) => state.playerConfiguration

export const selectPlayList = (state: rootStore) =>
  state.playerConfiguration.playList

const PlayerConfigurationReducer = playerConfiguration.reducer

export default PlayerConfigurationReducer
