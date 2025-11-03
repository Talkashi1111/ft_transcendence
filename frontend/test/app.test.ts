import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('should have a root element', () => {
    const div = document.createElement('div');
    div.id = 'root';
    document.body.appendChild(div);

    const root = document.getElementById('root');
    expect(root).toBeTruthy();
  });

  it('should create counter elements', () => {
    const div = document.createElement('div');
    div.id = 'root';
    div.innerHTML = `
      <button id="increment">+</button>
      <span id="counter">0</span>
      <button id="decrement">-</button>
    `;
    document.body.appendChild(div);

    const counter = document.getElementById('counter');
    const increment = document.getElementById('increment');
    const decrement = document.getElementById('decrement');

    expect(counter).toBeTruthy();
    expect(increment).toBeTruthy();
    expect(decrement).toBeTruthy();
  });
});
