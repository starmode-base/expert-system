import { registerGlobalMiddleware } from "@tanstack/react-start";
import { logMiddleware } from "./middleware/logging-middleware";

registerGlobalMiddleware({
  middleware: [logMiddleware],
});
