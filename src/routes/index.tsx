import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  loader: () => {
    throw redirect({
      to: '/pedidos-venda',
      search: { status: 'all', page: undefined },
      replace: true,
    })
  },
})
