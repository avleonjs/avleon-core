import { FileQueueAdapter } from "./queue";
import { promises as fs } from "fs";
import { join } from "path";

jest.mock("fs", () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
    },
}));

const mockQueueFile = join(__dirname, "testqueue.json");

describe("FileQueueAdapter", () => {
    const jobs = [{ id: "1", data: "foo" }, { id: "2", data: "bar" }];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should load jobs from file", async () => {
        (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(jobs));
        const adapter = new FileQueueAdapter("testqueue");
        const loaded = await adapter.loadJobs();
        expect(loaded).toEqual(jobs);
        expect(fs.readFile).toHaveBeenCalledWith(mockQueueFile, "utf-8");
    });

    it("should return empty array if file does not exist", async () => {
        (fs.readFile as jest.Mock).mockRejectedValue(new Error("not found"));
        const adapter = new FileQueueAdapter("testqueue");
        const loaded = await adapter.loadJobs();
        expect(loaded).toEqual([]);
    });

    it("should save jobs to file", async () => {
        const adapter = new FileQueueAdapter("testqueue");
        await adapter.saveJobs(jobs);
        expect(fs.writeFile).toHaveBeenCalledWith(
            mockQueueFile,
            JSON.stringify(jobs, null, 2),
            "utf-8"
        );
    });
});

describe("QueueManager and SimpleQueue", () => {
    let adapter: FileQueueAdapter;
    // let queueManager: QueueManager;
    let handler: jest.Mock;

    // beforeEach(() => {
    //     jest.clearAllMocks();
    //     adapter = new FileQueueAdapter("testqueue");
    //     queueManager = QueueManager.getInstance(adapter);
    //     handler = jest.fn().mockResolvedValue(undefined);
    //     (fs.readFile as jest.Mock).mockResolvedValue("[]");
    //     (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    // });

    // it("should create a queue and add a job", async () => {
    //     const queue = queueManager.createQueue(handler);
    //     await queue.addJob({ foo: "bar" });
    //     expect(fs.readFile).toHaveBeenCalled();
    //     expect(fs.writeFile).toHaveBeenCalled();
    // });

    // it("should process jobs using handler", async () => {
    //     (fs.readFile as jest.Mock)
    //         .mockResolvedValueOnce("[]")
    //         .mockResolvedValueOnce(JSON.stringify([{ id: "1", data: "baz" }]))
    //         .mockResolvedValueOnce("[]");
    //     const queue = queueManager.createQueue(handler);
    //     await queue.addJob("baz");
    //     expect(handler).toHaveBeenCalled();
    // });

    // it("should requeue job if handler throws", async () => {
    //     handler.mockRejectedValueOnce(new Error("fail"));
    //     (fs.readFile as jest.Mock)
    //         .mockResolvedValueOnce("[]")
    //         .mockResolvedValueOnce(JSON.stringify([{ id: "1", data: "baz" }]))
    //         .mockResolvedValueOnce(JSON.stringify([{ id: "1", data: "baz" }]));
    //     const queue = queueManager.createQueue(handler);
    //     await queue.addJob("baz");
    //     expect(handler).toHaveBeenCalled();
    //     expect(fs.writeFile).toHaveBeenCalledTimes(2);
    // });

    // it("QueueManager should be singleton", () => {
    //     const another = QueueManager.getInstance(adapter);
    //     expect(another).toBe(queueManager);
    // });
});