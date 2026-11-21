import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent, SelectOption } from './select.component';

@Component({
  standalone: true,
  imports: [SelectComponent, ReactiveFormsModule],
  template: `<app-select [options]="options" [formControl]="control" />`,
})
class HostComponent {
  control = new FormControl<string | null>(null);
  options: SelectOption<string>[] = [
    { value: 'A', label: 'Baily Road' },
    { value: 'B', label: 'Shahbagh', disabled: true, note: 'Used as pickup' },
    { value: 'C', label: 'Bijoy Sarani' },
  ];
}

describe('SelectComponent (custom dropdown as a form control)', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    const key = (k: string) => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      fixture.detectChanges();
    };
    return { fixture, trigger, key, host: fixture.componentInstance };
  };

  it('reflects form values written from outside', () => {
    const { fixture, trigger, host } = setup();
    host.control.setValue('C');
    fixture.detectChanges();
    expect(trigger.textContent).toContain('Bijoy Sarani');
  });

  it('selects with the keyboard and skips disabled options', () => {
    const { trigger, key, host } = setup();
    key('ArrowDown'); // open → active = first enabled (A)
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    key('ArrowDown'); // B is disabled → moves to C
    key('Enter');
    expect(host.control.value).toBe('C');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(host.control.touched).toBeTrue();
  });

  it('closes on Escape without changing the value', () => {
    const { key, host } = setup();
    host.control.setValue('A');
    key('Enter');
    key('ArrowDown');
    key('Escape');
    expect(host.control.value).toBe('A');
  });
});
