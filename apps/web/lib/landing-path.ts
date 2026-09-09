import { APP_ROUTES, type AppRoute } from './routes';

function routesForLanding(showDefectAnalytics: boolean): AppRoute[] {
  if (showDefectAnalytics) return APP_ROUTES;
  const withoutHome = APP_ROUTES.filter((r) => r.href !== '/');
  const trackerIdx = withoutHome.findIndex((r) => r.href === '/tracker');
  const bugIdx = withoutHome.findIndex((r) => r.href === '/bug-budget');
  if (trackerIdx === -1 || bugIdx === -1 || bugIdx < trackerIdx) return withoutHome;
  const next = [...withoutHome];
  const [bug] = next.splice(bugIdx, 1);
  next.splice(trackerIdx, 0, bug);
  return next;
}

/** Where to send a user who may not open the page they asked for. */
export function landingPathFor(
  permissions: string[],
  options?: { showDefectAnalytics?: boolean },
): string {
  const show = options?.showDefectAnalytics !== false;
  return (
    routesForLanding(show).find((route) => permissions.includes(route.permission))?.href ??
    '/no-access'
  );
}
