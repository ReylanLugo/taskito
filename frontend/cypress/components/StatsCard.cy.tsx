import React from "react";
import { StatsCard } from "@/components/dashboard/stats-card";
import "@/app/globals.css";

// This spec focuses on meaningful assertions for a presentational card:
// - Correct heading text
// - Exact numeric rendering (including 0 and large numbers)
// - No truncation/ellipsis introduced by styles for typical values

describe("StatsCard", () => {
  const mountCard = (title: string, value: number) => {
    cy.mount(
      <div style={{ width: 320 }}>
        <StatsCard title={title} value={value} />
      </div>
    );
  };

  const cases: Array<{ title: string; value: number; expected: string }> = [
    { title: "Total Tasks", value: 0, expected: "0" },
    { title: "Completed", value: 42, expected: "42" },
    { title: "Overdue", value: 1234, expected: "1234" },
  ];

  cases.forEach(({ title, value, expected }) => {
    it(`renders title and exact value for ${title}=${value}`, () => {
      cy.viewport(1000, 800);
      mountCard(title, value);

      // Title should appear in the CardTitle (usually an h3)
      cy.contains(title).should("be.visible");

      // Value should render exactly inside the value container
      cy.get(".text-2xl.font-bold").should("have.text", expected);

      // Sanity: value is numeric (no extra symbols/spaces)
      cy.get(".text-2xl.font-bold")
        .invoke("text")
        .then((txt) => {
          expect(Number.isNaN(Number(txt))).to.be.false;
          expect(Number(txt)).to.eq(value);
        });
    });
  });
});
