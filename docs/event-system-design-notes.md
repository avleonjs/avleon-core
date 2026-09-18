import { AvleonEvent, BroadcastOption } from ".";

/* 
 event,
 queueEvent,
 listener,
 job,
 queue,
 worker,
 publish,
 subscribe,
 boroadcast

 here's is the general idea of hwo it should work:
 every listenr class should have a subscribe decorator that takes the event name as an argument.
 the subscribe decorator should register the listener class to the event name.
 when an event is fired, all the listener classes that are registered to that event name should be executed.

 okay now we're clear about the listenrers, let's talk about the queues, jobs and workers.
 a job is a function that is executed in a worker.
 a worker is a process that executes jobs.
 a queue is a data structure that holds jobs until they are executed by a worker.

 so when an event is fired, we can choose to execute the listeners immediately or we can choose to queue the listeners as jobs to be executed by workers.

 we can also choose to broadcast the event to other services or processes.


 now let's talk about the implementation  of how we can connect the queue system to the event system.
 we can have a method on the event class that allows us to specify that the listeners should be queued as jobs to be executed by workers.
 this method can take an optional argument that specifies the name of the queue to which the jobs should be added.
 if no queue name is specified, the jobs will be added to a default queue.

 now the problem with this approach is that we need to have a way to serialize the event and its payload so that it can be stored in the queue and
  later deserialized when it is executed by the worker.

 we can use JSON.stringify to serialize the event and its payload, but this will not work for complex objects or classes.
 we can use a library like class-transformer to serialize and deserialize the event and its payload, but this will add an extra dependency to our project.

 another approach is to have a method on the event class that allows us to specify a custom serializer and deserializer for the event and its payload.

 how will the worker registation work? 
 by Decorators, we can have a decorator that registers a class as a worker and specifies the queue that it listens to.
 or a system where we can manually register worker classes to queues.

 do we really need to have a separate worker class?
 we can have a system where we can specify that a listener should be executed in a worker and the system will automatically create a worker for that listener and execute it in the worker.
 but it won't align with standard practices of having a separate worker class that is responsible for executing jobs.

 and we can't implement BullMQ here 

 we can take queue, worker and job from BullMQ and implement them in our own way;

 // write a algorithm for how the event system will work with the queue system:

 1. When an event is fired, the system checks if the event has any listeners registered to it.
    2. If there are listeners registered to the event, the system checks if the event has any options specified for queuing the listeners as jobs to be executed by workers.
         3. If the event has options specified for queuing the listeners, the system serializes the event and its payload and adds it to the specified queue as a job.
                4. If the event does not have options specified for queuing the listeners, the system executes the listeners immediately.
                5. If the event has options specified for broadcasting the event to other services or processes, the system broadcasts the event to the specified channels or topics.
                6. When a worker picks up a job from the queue, it deserializes the event and its payload and executes the listeners for that event.
                7. If the job fails, the system checks if the event has any options specified for retrying the job and if so, it retries the job according to the specified options.
*/


export class Fire{

    private constructor(){}

    static event(name: AvleonEvent| string, payload?: any) {
       return new Fire();
    }

     toQueue(queue: string="default"):this{
        return this;
     }

     after(delay: number):this{
        return this;
     }

     retry(n: number):this{
        return this;
     }

     broadcast(opt: BroadcastOption){
        return this;
    }

    async dispatch():Promise<void>{

    }

    
}

Fire.event("user.created", { id: 123, name: "Alice" })
.toQueue()
.after(5000)
.retry(3)
.broadcast({ type: "socket", channel: "users" })
.dispatch();


export function React(event: any) {
    return {
        toQueue(queue: string="default") {  
            return this;
        },
        after(delay: number) {
            return this;
        },
        retry(n: number) {
            return this;
        },
        broadcast(opt: BroadcastOption) {
            return this;
        },
        async dispatch() {
            // Implementation of dispatching the event
        }
    };
}

React("user.created")
.toQueue()
.after(5000)
.retry(3)
.broadcast({ type: "socket", channel: "users" })
.dispatch();