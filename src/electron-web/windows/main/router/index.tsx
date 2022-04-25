import type { RouteObject } from 'react-router-dom'
import Wallpaper from './Wallpaper'
import NotMatch from './NotMatch'
import Home from './Home'
import { Layout } from './layout'
import Plugins from './Plugins'

const routers: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: 'explore',
        element: <Home />,
      },
      {
        index: true,
        element: <Wallpaper />,
      },
      {
        path: 'plugin',
        element: <Plugins />,
      },
    ],
  },
  {
    path: '*',
    element: <NotMatch />,
  },
]

export default routers
