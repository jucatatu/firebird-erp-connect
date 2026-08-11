
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getErpOrderDetailDiagnostic = createServerFn({ method: "GET" })
  .inputValidator((orderNumber: number) => z.number().parse(orderNumber))
  .handler(async ({ data: orderNumber }) => {
    const { callErp } = await import("./erp.server");
    return callErp({
      method: "GET",
      path: `/api/v1/orders/${orderNumber}`
    });
  });
