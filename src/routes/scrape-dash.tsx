import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/scrape-dash')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/scrape-dash"!</div>
}
