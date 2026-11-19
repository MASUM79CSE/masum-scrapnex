import { PRODUCT_NAME } from "../../src/data/contracts";
import { mount } from "../../src/styles/mount";

mount(
  <main className="space-y-3 p-4 text-sm">
    <h1 className="text-lg font-semibold">{PRODUCT_NAME} settings</h1>
    <p>
      No data collection or configurable settings are enabled in this build.
    </p>
  </main>,
);
