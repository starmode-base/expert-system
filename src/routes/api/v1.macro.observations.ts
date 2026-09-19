import { createAPIFileRoute } from "@tanstack/react-start/api";
import { macroObservations } from "~/server/public-api/macro-operations";
import { jsonInput, runRestOperation } from "~/server/public-api/rest";

export const APIRoute = createAPIFileRoute("/api/v1/macro/observations")({
  POST: ({ request }) =>
    runRestOperation(request, macroObservations, () => jsonInput(request)),
});
