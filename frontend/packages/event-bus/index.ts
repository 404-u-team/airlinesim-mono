export class EventBus {
    emit(event: string, payload: any) {
        console.log(`Event ${event} fired!`, payload);
    }
}

export const bus = new EventBus();