import { APP_ROUTES } from './routes';

/** Where to send a user who may not open the page they asked for. */
export function landingPathFor(permissions: string[]): string {
  return APP_ROUTES.find((route) => permissions.includes(route.permission))?.href ?? '/no-access';
}
