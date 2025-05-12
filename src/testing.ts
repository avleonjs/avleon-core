import 'reflect-metadata';
import { Container } from 'typedi';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AvleonApplication } from './icore';

// Enhanced Test Utilities
export class AvleonTestUtility {
  private static testDataSource: DataSource | null = null;
  private static testContainer: typeof Container;

  /**
   * Initialize test environment
   */
  static async init(options?: {
    dataSourceOptions?: DataSourceOptions;
    resetContainer?: boolean;
  }) {
    // Reset container if specified
    if (options?.resetContainer) {
      this.testContainer = Container;
      this.testContainer.reset();
    }

    // Initialize test database if options provided
    if (options?.dataSourceOptions) {
      this.testDataSource = new DataSource({
        ...options.dataSourceOptions,
        logging: false, // Disable logging during tests
      });

      await this.testDataSource.initialize();
      await this.testDataSource.synchronize(true); // Create schema
    }

    return this;
  }

  /**
   * Mock a dependency for testing
   * @param token Dependency token
   * @param mockImplementation Mock implementation
   */
  static mockDependency<T>(token: any, mockImplementation: T) {
    Container.set(token, mockImplementation);
    return mockImplementation;
  }

  /**
   * Create an isolated test instance of a class
   * @param ClassType Class to instantiate
   * @param overrides Optional property overrides
   */
  static createTestInstance<T>(
    ClassType: new (...args: any[]) => T,
    overrides: Partial<T> = {},
  ): T {
    const instance = Container.get(ClassType);

    // Apply overrides
    Object.keys(overrides).forEach((key) => {
      (instance as any)[key] = (overrides as any)[key];
    });

    return instance;
  }

  /**
   * Cleanup test environment
   */
  static async cleanup() {
    if (this.testDataSource) {
      await this.testDataSource.dropDatabase();
      await this.testDataSource.destroy();
      this.testDataSource = null;
    }

    // Reset container
    Container.reset();
  }
}

// Enhanced Test Builder
export class AvleonTestBuilder {
  private controllers: any[] = [];
  private testOptions: any = {};
  private mocks: Map<any, any> = new Map();

  /**
   * Add controllers for testing
   * @param controllers Controllers to add
   */
  addControllers(...controllers: any[]) {
    this.controllers.push(...controllers);
    return this;
  }

  /**
   * Mock a dependency
   * @param token Dependency token
   * @param mockImplementation Mock implementation
   */
  mockDependency(token: any, mockImplementation: any) {
    this.mocks.set(token, mockImplementation);
    return this;
  }

  /**
   * Set test options
   * @param options Test configuration options
   */
  setOptions(options: any) {
    this.testOptions = { ...this.testOptions, ...options };
    return this;
  }

  /**
   * Build test application
   */
  async build() {
    // Apply mocks
    this.mocks.forEach((mock, token) => {
      Container.set(token, mock);
    });

    // Initialize test utility
    await AvleonTestUtility.init({
      dataSourceOptions: this.testOptions.dataSourceOptions,
      resetContainer: true,
    });

    // Create test application
    const app = AvleonApplication.getInternalApp({
      dataSourceOptions: this.testOptions.dataSourceOptions,
    });

    // Map controllers
    app.useControllers(this.controllers);

    // Get test application
    return app.getTestApp();
  }
}

// Example Usage Decorator
export function UnitTest() {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        // Pre-test setup
        await AvleonTestUtility.init();

        // Execute test
        const result = await originalMethod.apply(this, args);

        // Post-test cleanup
        await AvleonTestUtility.cleanup();

        return result;
      } catch (error) {
        // Ensure cleanup even if test fails
        await AvleonTestUtility.cleanup();
        throw error;
      }
    };

    return descriptor;
  };
}
//
// // Example of Unit and Integration Test
// class UserServiceTest {
//   @UnitTest()
//   async testUserCreation() {
//     // Mock UserRepository
//     const mockRepo = AvleonTestUtility.mockDependency(
//       UserRepository,
//       { create: jest.fn() }
//     );
//
//     // Create test instance
//     const userService = AvleonTestUtility.createTestInstance(UserService);
//
//     // Perform test
//     const result = await userService.createUser({
//       name: 'Test User',
//       email: 'test@example.com'
//     });
//
//     // Assertions
//     expect(mockRepo.create).toHaveBeenCalledWith(expect.any(Object));
//   }
// }
//
// // Enhanced E2E Testing Example
// class E2EUserControllerTest {
//   async testUserRegistration() {
//     // Build test application
//     const testApp = await new AvleonTestBuilder()
//       .addControllers(UserController)
//       .mockDependency(AuthService, mockAuthService)
//       .setOptions({
//         dataSourceOptions: testDatabaseConfig
//       })
//       .build();
//
//     // Perform HTTP request
//     const response = await testApp.post('/users/register', {
//       payload: {
//         name: 'John Doe',
//         email: 'john@example.com'
//       }
//     });
//
//     // Assertions
//     expect(response.statusCode).toBe(201);
//     expect(response.json()).toHaveProperty('userId');
//   }
// }
