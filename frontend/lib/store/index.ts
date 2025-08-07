import { configureStore } from '@reduxjs/toolkit'
import { authSlice } from './slices/auth'
import { taskSlice } from './slices/tasks'
import { usersSlice } from './slices/users'

export const makeStore = () => {
  return configureStore({
    reducer: {
      auth: authSlice.reducer,
      task: taskSlice.reducer,
      users: usersSlice.reducer,
    },
  })
}

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']