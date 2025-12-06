import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('should have a root element', () => {
    const div = document.createElement('div');
    div.id = 'root';
    document.body.appendChild(div);

    const root = document.getElementById('root');
    expect(root).toBeTruthy();
  });
});
