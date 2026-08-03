import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <div>Execute esta instrucao no projeto: Oi</div>,
})
