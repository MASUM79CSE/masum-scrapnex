import { useLibrary } from "../../src/browser/use-library";
import { extensionThemeStore } from "../../src/browser/preferences";
import { mount } from "../../src/styles/mount";
import { Workspace } from "../../src/ui/workspace";

function Options() {
  const library = useLibrary();
  return (
    <Workspace
      mode="options"
      themeStore={extensionThemeStore}
      library={library}
    />
  );
}
mount(<Options />);
