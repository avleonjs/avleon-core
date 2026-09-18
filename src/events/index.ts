// ============================================================
// Avleon Event System — Complete Implementation
// ============================================================

// ─── Broadcast & Options ────────────────────────────────────

export interface Broadcast {
    to: string;
    private?: boolean;
    payload: any;
}

export type SocketBroadcastOption = {
    type: "socket";
    channel: string;
    room?: string;
};

export type RabbitMqBroadcastOption = {
    type: "rabbitmq";
    queue: string;
};

export type KafkaBroadcastOption = {
    type: "kafka";
    topic: string;
};

export type BroadcastOption =
    | SocketBroadcastOption
    | RabbitMqBroadcastOption
    | KafkaBroadcastOption
    | false;

export type DispatchOption =
    | {
        broadcast?: BroadcastOption;
        queue: true;
        delay?: number;
        retry?: number;
        retryDelay?: number; // milliseconds
    }
    | {
        broadcast?: BroadcastOption;
        queue?: false;
        delay?: number;
        retry?: never;
        retryDelay?: never;
    };

const defaultDispatchOption: DispatchOption = {
    broadcast: false,
    queue: false,
    delay: 0
};

// ─── Core Interfaces ────────────────────────────────────────

export interface AvleonEventInterface {
    name: string;
    timestamp: number;
}

export interface AvleonEventListenerInterface<TEvent extends AvleonEventInterface = any> {
    handler(event: TEvent): void | Promise<void>;
}

// ─── Base Event ─────────────────────────────────────────────

export abstract class AvleonEvent<TPayload = any> implements AvleonEventInterface {
    public readonly name: string;
    public readonly timestamp: number;

    constructor(public payload: TPayload) {
        this.name = this.constructor.name;
        this.timestamp = Date.now();
    }
}

// ─── Base Listener ──────────────────────────────────────────

export abstract class AvleonEventListener<TEvent extends AvleonEvent = AvleonEvent>
    implements AvleonEventListenerInterface<TEvent> {
    abstract handler(event: TEvent): void | Promise<void>;
}

// ─── Event Registry ─────────────────────────────────────────

type ListenerEntry = {
    listener: AvleonEventListenerInterface;
    once: boolean;
};

export class EventRegistry {
    private static instance: EventRegistry;
    private readonly registry = new Map<string, ListenerEntry[]>();

    static getInstance(): EventRegistry {
        if (!EventRegistry.instance) {
            EventRegistry.instance = new EventRegistry();
        }
        return EventRegistry.instance;
    }

    /** Register a persistent listener for an event class. */
    register<TEvent extends AvleonEvent>(
        eventClass: new (...args: any[]) => TEvent,
        listener: AvleonEventListenerInterface<TEvent>
    ): void {
        this._add(eventClass.name, listener, false);
    }

    /** Register a one-time listener that fires only on the next occurrence. */
    once<TEvent extends AvleonEvent>(
        eventClass: new (...args: any[]) => TEvent,
        listener: AvleonEventListenerInterface<TEvent>
    ): void {
        this._add(eventClass.name, listener, true);
    }

    /** Remove a specific listener for an event class. */
    unregister<TEvent extends AvleonEvent>(
        eventClass: new (...args: any[]) => TEvent,
        listener: AvleonEventListenerInterface<TEvent>
    ): void {
        const key = eventClass.name;
        const entries = this.registry.get(key) ?? [];
        this.registry.set(
            key,
            entries.filter((e) => e.listener !== listener)
        );
    }

    /** Retrieve all active listener entries for an event name. */
    getListeners(eventName: string): ListenerEntry[] {
        return this.registry.get(eventName) ?? [];
    }

    /** Flush one-time listeners after they have been invoked. */
    flushOnce(eventName: string): void {
        const entries = this.registry.get(eventName) ?? [];
        this.registry.set(
            eventName,
            entries.filter((e) => !e.once)
        );
    }

    private _add(
        key: string,
        listener: AvleonEventListenerInterface,
        once: boolean
    ): void {
        const entries = this.registry.get(key) ?? [];
        entries.push({ listener, once });
        this.registry.set(key, entries);
    }
}

// ─── Queue (In-Memory) ──────────────────────────────────────

type QueuedJob = {
    event: AvleonEvent;
    option: DispatchOption;
    attempts: number;
};

export class EventQueue {
    private static instance: EventQueue;
    private readonly jobs: QueuedJob[] = [];
    private processing = false;

    static getInstance(): EventQueue {
        if (!EventQueue.instance) {
            EventQueue.instance = new EventQueue();
        }
        return EventQueue.instance;
    }

    enqueue(event: AvleonEvent, option: DispatchOption): void {
        this.jobs.push({ event, option, attempts: 0 });
        if (!this.processing) {
            // Defer processing to the next tick so the call stack clears first.
            Promise.resolve().then(() => this.process());
        }
    }

    private async process(): Promise<void> {
        this.processing = true;
        while (this.jobs.length > 0) {
            const job = this.jobs.shift()!;
            await this.run(job);
        }
        this.processing = false;
    }

    private async run(job: QueuedJob): Promise<void> {
        const registry = EventRegistry.getInstance();
        const entries = registry.getListeners(job.event.name);

        const maxRetries = (job.option as any).retry ?? 0;
        const retryDelay = (job.option as any).retryDelay ?? 1000;

        for (const entry of entries) {
            let success = false;
            let lastError: unknown;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    await entry.listener.handler(job.event);
                    success = true;
                    break;
                } catch (err) {
                    lastError = err;
                    if (attempt < maxRetries) {
                        await delay(retryDelay);
                    }
                }
            }

            if (!success) {
                console.error(
                    `[EventQueue] Listener for "${job.event.name}" failed after ${maxRetries + 1} attempt(s):`,
                    lastError
                );
            }
        }

        registry.flushOnce(job.event.name);
    }
}

// ─── Broadcast Adapters ─────────────────────────────────────

/**
 * Implement these adapters to wire up real transports.
 * The stubs below log to console so the system is self-contained.
 */

async function broadcastSocket(
    event: AvleonEvent,
    option: SocketBroadcastOption
): Promise<void> {
    console.log(
        `[Socket] channel="${option.channel}"${option.room ? ` room="${option.room}"` : ""} →`,
        { name: event.name, payload: event.payload }
    );
    // Replace with real Socket.IO / ws emission:
    // io.to(option.room ?? option.channel).emit(option.channel, { name: event.name, payload: event.payload });
}

async function broadcastRabbitMq(
    event: AvleonEvent,
    option: RabbitMqBroadcastOption
): Promise<void> {
    console.log(`[RabbitMQ] queue="${option.queue}" →`, {
        name: event.name,
        payload: event.payload,
    });
    // Replace with real amqplib publish call.
}

async function broadcastKafka(
    event: AvleonEvent,
    option: KafkaBroadcastOption
): Promise<void> {
    console.log(`[Kafka] topic="${option.topic}" →`, {
        name: event.name,
        payload: event.payload,
    });
    // Replace with real KafkaJS producer.send call.
}

async function handleBroadcast(
    event: AvleonEvent,
    broadcastOption: BroadcastOption
): Promise<void> {
    if (!broadcastOption) return;

    switch (broadcastOption.type) {
        case "socket":
            await broadcastSocket(event, broadcastOption);
            break;
        case "rabbitmq":
            await broadcastRabbitMq(event, broadcastOption);
            break;
        case "kafka":
            await broadcastKafka(event, broadcastOption);
            break;
    }
}

type DelayInput = string | number;

function parseDelay(input: DelayInput): number {
    if (typeof input === "number") return input;

    const match = input.match(/^(\d+)(ms|s|m|h|d|day|days)$/);
    if (!match) throw new Error("Invalid delay format");

    const value = Number(match[1]);
    const unit = match[2];

    switch (unit) {
        case "ms": return value;
        case "s": return value * 1000;
        case "m": return value * 60 * 1000;
        case "h": return value * 60 * 60 * 1000;
        case "d": return value * 24 * 60 * 60 * 1000;
        case "day": return value * 24 * 60 * 60 * 1000;
        case "days": return value * 24 * 60 * 60 * 1000;
        default: throw new Error("Unknown unit");
    }
}

// ─── Event Dispatcher ───────────────────────────────────────

export class EventDispatcher {
    private readonly registry = EventRegistry.getInstance();
    private readonly queue = EventQueue.getInstance();

    /**
     * Dispatch an event.
     *
     * - If `queue: true`, listeners run asynchronously via the in-memory queue
     *   with optional retry / retryDelay support.
     * - If `queue: false` (default), listeners run synchronously in the current tick.
     * - If a `broadcast` option is provided, the event is also forwarded to the
     *   configured transport (Socket, RabbitMQ, Kafka).
     */
    async dispatch(event: AvleonEvent, option?: DispatchOption): Promise<void> {
        const finalOption: DispatchOption = option ?? defaultDispatchOption;

        // ── Broadcast ─────────────────────────────────
        if (finalOption.broadcast) {
            await handleBroadcast(event, finalOption.broadcast);
        }

        // ── Queue or direct invocation ─────────────────
        if (finalOption.queue) {
            this.queue.enqueue(event, finalOption);
        } else {
            if(finalOption.delay){
                const delay = parseDelay(finalOption.delay);
                setTimeout(async ()=> await this.invokeListeners(event) ,delay);

            }else{
                await this.invokeListeners(event);
            }
            
        }
    }

    private async invokeListeners(event: AvleonEvent): Promise<void> {
        const entries = this.registry.getListeners(event.name);

        for (const entry of entries) {
            try {
                await entry.listener.handler(event);
            } catch (err) {
                console.error(
                    `[EventDispatcher] Listener for "${event.name}" threw:`,
                    err
                );
            }
        }

        this.registry.flushOnce(event.name);
    }
}

// ─── Helper ─────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Usage Example
// ============================================================

type UserCreatePayload = {
    userId: number;
    name: string;
};

class UserCreateEvent extends AvleonEvent<UserCreatePayload> { }

class UserCreateCompleted extends AvleonEvent { };

// --- Listeners ---

class UserCreateListener extends AvleonEventListener<UserCreateEvent> {
    async handler(event: UserCreateEvent): Promise<void> {
        console.log(`[UserCreateListener] User created → id=${event.payload.userId}, name="${event.payload.name}"`);
    }
}

class UserCreateAuditListener extends AvleonEventListener<UserCreateEvent> {
    handler(event: UserCreateEvent): void {
        console.log(`[AuditLog] ${event.name} at ${new Date(event.timestamp).toISOString()}`);
    }
}

class UserCreateCompletedListener extends AvleonEventListener<UserCreateEvent> {
    handler(event: UserCreateEvent): void | Promise<void> {
        console.log(`[UserCreateCompletedListener] User created completed → name=${event.name}"`);
    }
}

// --- Wire up ---

const registry = EventRegistry.getInstance();
registry.register(UserCreateEvent, new UserCreateListener());
registry.register(UserCreateEvent, new UserCreateAuditListener());
registry.register(UserCreateCompleted, new UserCreateCompletedListener());

// Register a one-time welcome notifier
registry.once(UserCreateEvent, {
    handler(event: UserCreateEvent) {
        console.log(`[Welcome] Sending welcome email to "${event.payload.name}"`);
    },
});

// --- Dispatch ---

async function main() {

    const dispatcher = new EventDispatcher();

    // Queued dispatch with retry + Socket broadcast
    await dispatcher.dispatch(
        new UserCreateEvent({ userId: 1, name: "Tareq" }),
        {
            broadcast: {
                type: "socket",
                channel: "user:create",
            },
            queue: true,
            retry: 3,
            retryDelay: 500,
        }
    );

    // Direct (non-queued) dispatch — the one-time listener is already consumed above
    await dispatcher.dispatch(
        new UserCreateEvent({ userId: 2, name: "Rafi" }),
        {
            broadcast: {
                type: "kafka",
                topic: "user.created",
            },
        }
    );


    await dispatcher.dispatch(new UserCreateCompleted({}), {
        queue: true,
        retry: 2,
        retryDelay: 3000
    });
}

main();
