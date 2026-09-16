import Block from '../blots/block.js';
import Container from '../blots/container.js';
import type Scroll from '../blots/scroll.js';
import Quill from '../core/quill.js';

class ListContainer extends Container {}
ListContainer.blotName = 'list-container';
ListContainer.tagName = 'OL';

// The checkbox role goes on the <li> itself so that the item's own text becomes its
// accessible name; the rendered box is decoration and must not be announced.
const syncChecklistState = (node: HTMLElement, value: unknown) => {
  if (value === 'checked' || value === 'unchecked') {
    node.setAttribute('role', 'checkbox');
    node.setAttribute('aria-checked', String(value === 'checked'));
  } else {
    node.removeAttribute('role');
    node.removeAttribute('aria-checked');
  }
};

class ListItem extends Block {
  static create(value: string) {
    const node = super.create() as HTMLElement;
    node.setAttribute('data-list', value);
    return node;
  }

  static formats(domNode: HTMLElement) {
    return domNode.getAttribute('data-list') || undefined;
  }

  static register() {
    Quill.register(ListContainer);
  }

  constructor(scroll: Scroll, domNode: HTMLElement) {
    super(scroll, domNode);
    // Runs for parsed and pasted nodes too, which never go through create().
    syncChecklistState(domNode, domNode.getAttribute('data-list'));
    const ui = domNode.ownerDocument.createElement('span');
    const listEventHandler = (e: Event) => {
      if (!scroll.isEnabled()) return;
      const format = this.statics.formats(domNode, scroll);
      if (format === 'checked') {
        this.format('list', 'unchecked');
        e.preventDefault();
      } else if (format === 'unchecked') {
        this.format('list', 'checked');
        e.preventDefault();
      }
    };
    ui.setAttribute('aria-hidden', 'true');
    ui.addEventListener('mousedown', listEventHandler);
    ui.addEventListener('touchstart', listEventHandler);
    this.attachUI(ui);
  }

  format(name: string, value: string) {
    if (name === this.statics.blotName && value) {
      this.domNode.setAttribute('data-list', value);
      syncChecklistState(this.domNode, value);
    } else {
      super.format(name, value);
    }
  }
}
ListItem.blotName = 'list';
ListItem.tagName = 'LI';

ListContainer.allowedChildren = [ListItem];
ListItem.requiredContainer = ListContainer;

export { ListContainer, ListItem as default };
