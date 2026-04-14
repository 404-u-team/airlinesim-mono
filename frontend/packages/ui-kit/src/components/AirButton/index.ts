import { defineCustomElement } from 'vue';
import AirButtonComponent from './AirButton.ce.vue';

export const AirButton = defineCustomElement(AirButtonComponent, {
    shadowRoot: false
});

export function registerAirButton() {
    if (!customElements.get('air-button')) {
        customElements.define('air-button', AirButton);
    }
}