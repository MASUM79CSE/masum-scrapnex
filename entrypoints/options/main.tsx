import { extensionThemeStore } from "../../src/browser/preferences";
import { mount } from "../../src/styles/mount";
import { Workspace } from "../../src/ui/workspace";

mount(<Workspace mode="options" themeStore={extensionThemeStore} />);
