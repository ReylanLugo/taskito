import React from "react";
import { TasksPriorityChartComponent } from "@/components/dashboard/tasks-priority-chart";
import "@/app/globals.css";

const sampleData = [
  { name: "Alta", value: 4 },
  { name: "Media", value: 3 },
  { name: "Baja", value: 3 },
];

describe("TasksPriorityChartComponent", () => {
  const mountChart = (data = sampleData) => {
    cy.mount(
      <div style={{ width: 600, height: 400 }}>
        <TasksPriorityChartComponent data={data} />
      </div>
    );
  };

  it("renders legend, labels with percentages and one sector per datum", () => {
    cy.viewport(1000, 800);
    mountChart();

    // Wait for chart surface
    cy.get("svg.recharts-surface").should("exist");

    // Legend shows all names
    ["Alta", "Media", "Baja"].forEach((n) => {
      cy.contains(n).should("be.visible");
    });

    // Sectors count equals data length
    cy.get("path.recharts-sector").should("have.length", sampleData.length);

    // Percentage labels are rendered by custom label fn
    cy.contains("Alta: 40%").should("be.visible");
    cy.contains("Media: 30%").should("be.visible");
    cy.contains("Baja: 30%").should("be.visible");

    // Optional: exercise hover without asserting tooltip visibility (flaky across envs)
    cy.get("path.recharts-sector").first().trigger("mousemove", { force: true });
  });

  it("updates percentages when data changes", () => {
    const data = [
      { name: "Alta", value: 1 },
      { name: "Media", value: 1 },
      { name: "Baja", value: 8 },
    ];

    cy.viewport(1000, 800);
    mountChart(data);
    cy.get("svg.recharts-surface").should("exist");

    cy.contains("Alta: 10%").should("be.visible");
    cy.contains("Media: 10%").should("be.visible");
    cy.contains("Baja: 80%").should("be.visible");
  });
});
