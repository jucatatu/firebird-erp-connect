import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/')({
  loader: () => {
    throw redirect({ to: '/pedidos-venda', replace: true })
  },
})
