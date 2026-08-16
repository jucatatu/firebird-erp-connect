import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Firebird ERP Connect</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Sistema de integração oficial com ERP Firebird.
      </p>
    </div>
  ),
})
