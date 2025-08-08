// cypress/e2e/tasks-grid.cy.ts

describe("Dashboard", () => {
  beforeEach(() => {
    // Set up auth state by mocking the profile request
    cy.intercept("GET", "/api/auth/me", { fixture: "user.json" }).as(
      "getProfile"
    );
    // Mock the initial statistics request
    cy.intercept("GET", "/api/tasks/statistics", {
      fixture: "statistics.json",
    }).as("getStatistics");
    // Mock the initial tasks request
    cy.intercept("GET", "/api/tasks/*", { fixture: "tasks.json" }).as(
      "getTasks"
    );
    // Mock the initial users request
    cy.intercept("GET", "/api/auth/users", { fixture: "users.json" }).as(
      "getUsers"
    );

    // Set authentication cookies
    cy.setCookie("taskito_access_token", "test-auth-token");
    cy.setCookie("taskito_refresh_token", "test-refresh-token");

    // Visit the dashboard directly with auth cookies already set
    cy.visit("/dashboard");

    // Wait for tasks to load
    cy.wait("@getTasks");
  });

  it("should render tasks correctly", () => {
    // Check that tasks are rendered
    cy.get('[data-testid="task-card"]').should("have.length.at.least", 1);

    // Check task content
    cy.get('[data-testid="task-card"]')
      .first()
      .within(() => {
        cy.get('[data-testid="task-title"]').should("be.visible");
        cy.get('[data-testid="task-description"]').should("be.visible");
        cy.get('[data-testid="task-due-date"]').should("be.visible");
      });
  });

  it("should filter tasks based on completion status", () => {
    // Mock the filtered tasks response
    cy.intercept("GET", "/api/tasks/*completed=true*", {
      fixture: "completed-tasks.json",
    }).as("getTasks");

    // Select completed filter
    cy.get('[data-testid="completion-filter"]').click();
    cy.get('[data-value="true"]').click();
    cy.get('[data-testid="apply-filters"]').click();

    // Wait for filtered request
    cy.wait("@getTasks");

    // Check that all displayed tasks are completed
    cy.get('[data-testid="task-card"]').each(($card) => {
      cy.wrap($card)
        .find('[data-testid="completed-indicator"]')
        .should("be.visible");
    });
  });

  it("should filter tasks based on priority", () => {
    // Mock the filtered tasks response
    cy.intercept("GET", "/api/tasks/*priority=alta*", {
      fixture: "high-priority-tasks.json",
    }).as("getTasks");

    // Select priority filter
    cy.get('[data-testid="priority-filter"]').click();
    cy.get('[data-value="alta"]').click();
    cy.get('[data-testid="apply-filters"]').click();

    // Wait for filtered request
    cy.wait("@getTasks");

    // Check that all displayed tasks have high priority
    cy.get('[data-testid="task-card"]').each(($card) => {
      cy.wrap($card)
        .find('[data-testid="priority-label"]')
        .should("be.visible");
      cy.wrap($card)
        .find('[data-testid="priority-text"]')
        .should("contain", "High");
    });
  });

  it("should mark a task as completed", () => {
    // Mock the completion endpoint
    cy.intercept("PUT", "/api/tasks/1", { statusCode: 200 }).as(
      "markTaskAsCompleted"
    );

    // Click the complete button on the first task
    cy.get('[data-testid="task-card"]')
      .first()
      .within(() => {
        cy.get('[data-testid="mark-task-as-completed"]').click();
      });

    // Wait for the API call
    cy.wait("@markTaskAsCompleted");

    // Check for success toast with Sonner's structure
    // Sonner uses [data-sonner-toast] attribute
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]").contains(/Task|marked|completed/i, {
      matchCase: false,
    });
  });

  it("should delete a task", () => {
    // Mock the delete endpoint
    cy.intercept("DELETE", "/api/tasks/*", { statusCode: 204 }).as(
      "deleteTask"
    );

    // Click the delete button on the first task
    cy.get('[data-testid="task-card"]')
      .first()
      .within(() => {
        cy.get('[data-testid="delete-task"]').click();
      });

    // Wait for the API call
    cy.wait("@deleteTask");

    // Check for success toast with Sonner's structure
    // Sonner uses [data-sonner-toast] attribute
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]").contains(/Task|deleted|successfully/i, {
      matchCase: false,
    });
  });

  it("should add a comment to a task", () => {
    // Mock the comment endpoint
    cy.intercept("POST", "/api/tasks/*/comments", { statusCode: 201 }).as(
      "addComment"
    );

    // Open task details
    cy.get('[data-testid="task-card"]').first().click();

    // Add a comment
    cy.get('[data-testid="comment-input"]').type("This is a test comment");
    cy.get('[data-testid="submit-comment"]').click();

    // Wait for the API call
    cy.wait("@addComment");

    // Check for success toast with Sonner's structure
    // Sonner uses [data-sonner-toast] attribute
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]").contains(/Comment|added|successfully/i, {
      matchCase: false,
    });
  });

  it("should load more tasks on scroll", () => {
    
    // Config intercept for second page
    cy.intercept("GET", "/api/tasks/*page=2*", {
      fixture: "tasks-page-2.json",
    }).as("getTasksPage2");
    
    // Wait for initial cards to be visible
    cy.get('[data-testid="task-card"]', { timeout: 5000 })
      .should('be.visible')
      .then(($cards) => {
        const initialCount = $cards.length;
        
        // Wait for scroll listeners to initialize
        cy.wait(1000);
        
        // Scroll to the bottom
        cy.get('[data-testid="task-card"]').last().scrollIntoView();

        // Wait for second page request
        cy.wait("@getTasksPage2", { timeout: 10000 });

        // Verify we have more tasks now
        cy.get('[data-testid="task-card"]', { timeout: 5000 }).should(
          "have.length.greaterThan",
          initialCount
        );
    });
  });

  it("should show empty state when no tasks are found", () => {
    
    // Intercepts the GET request for tasks
    cy.intercept("GET", "/api/tasks/*", {
      statusCode: 200,
      body: {
        tasks: [],
        page: 1,
        size: 10,
        pages: 0
      }
    }).as("getEmptyTasks");
    
    // Intercepts the GET request for statistics
    cy.intercept("GET", "/api/tasks/statistics", { fixture: "statistics.json" }).as("getStatistics");
    // Intercepts the GET request for users
    cy.intercept("GET", "/api/auth/users", { fixture: "users.json" }).as("getUsers");
    // Intercepts the GET request for profile
    cy.intercept("GET", "/api/auth/me", { fixture: "user.json" }).as("getProfile");

    // Visit the dashboard
    cy.visit("/dashboard");
    
    // Wait for the empty tasks request
    cy.wait("@getEmptyTasks", { timeout: 10000 });

    // Verify that the empty state message is visible
    cy.contains("No tasks found. Create a new task to get started!", { timeout: 5000 })
      .should("be.visible");
  });

  it("should show loading skeletons while loading more tasks", () => {
    // Setup intercepts before visiting the page
    // Intercept first page of tasks
    cy.intercept("GET", "/api/tasks/*page=1*", { fixture: "tasks-page-1.json" }).as("getTasksPage1");
    // Intercept auth endpoints to ensure page loads correctly
    cy.intercept("GET", "/api/tasks/statistics", { fixture: "statistics.json" }).as("getStatistics");
    cy.intercept("GET", "/api/auth/users", { fixture: "users.json" }).as("getUsers");
    cy.intercept("GET", "/api/auth/me", { fixture: "user.json" }).as("getProfile");

    // Set up intercept for second page with significant delay to ensure skeletons are visible
    cy.intercept("GET", "/api/tasks/*page=2*", {
      delay: 3000, // Longer delay to ensure skeletons are visible
      fixture: "tasks-page-2.json"
    }).as("getTasksPage2");

    // Visit the dashboard
    cy.visit("/dashboard");
    
    // Wait for first page of tasks to load
    cy.wait(["@getTasksPage1", "@getStatistics", "@getUsers"], { timeout: 10000 });

    // Create alias for task cards to track count
    cy.get('[data-testid="task-card"]', { timeout: 10000 })
      .should("be.visible")
      .should("have.length.at.least", 1)
      .then(($cards) => {
        // Store the initial count to verify more are loaded later
        const initialCount = $cards.length;
        cy.wrap(initialCount).as("initialCardCount");
      });

    // Wait a bit for all event handlers to attach
    cy.wait(1000);

    // Force scroll to bottom to trigger infinite loading
    cy.window().scrollTo('bottom');
    cy.get('[data-testid="task-card"]').last().scrollIntoView({ duration: 500 });
    
    // Assert that skeletons appear during loading
    // The component only shows skeletons during infinite scroll loading
    cy.get('[data-testid="task-skeleton"]', { timeout: 5000 })
      .should("exist")
      .should("be.visible")
      .then(() => {
        // Wait for the second page to load
        cy.wait("@getTasksPage2", { timeout: 10000 });

        // Get the initial count we saved earlier
        cy.get('@initialCardCount').then((initialCount) => {
          // After loading completes, verify more task cards appear
          cy.get('[data-testid="task-card"]', { timeout: 10000 })
            .should("have.length.greaterThan", initialCount);
          
          // And verify skeletons disappear
          cy.get('[data-testid="task-skeleton"]', { timeout: 5000 })
            .should("not.exist");
        });
      });
  });

  it("should search tasks by text", () => {
    // Mock the search response
    cy.intercept("GET", "/api/tasks/*search=test*", {
      fixture: "search-results.json",
    }).as("searchTasks");

    // Enter search term
    cy.get('[data-testid="search-input"]').type("test");
    cy.get('[data-testid="apply-filters"]').click();

    // Wait for search request
    cy.wait("@searchTasks");

    // Check that results contain the search term
    cy.get('[data-testid="task-card"]').should("contain", "test");
  });
});
