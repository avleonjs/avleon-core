# Avleon Event System — Usage Example

Reference example extracted from `src/events/event-registry.ts` during the codebase reorganization.

```ts
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
```
