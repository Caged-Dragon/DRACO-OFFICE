export type DocTemplate = {
  id: string;
  name: string;
  description: string;
  title: string;
  content: Record<string, unknown>;
};

function heading(level: number, text: string) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function paragraph(text = "") {
  return text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };
}

function bulletList(items: string[]) {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

export const TEMPLATES: DocTemplate[] = [
  {
    id: "blank",
    name: "Blank document",
    description: "Start with nothing.",
    title: "",
    content: { type: "doc", content: [paragraph()] },
  },
  {
    id: "resume",
    name: "Resume",
    description: "A simple chronological resume skeleton.",
    title: "Your Name",
    content: {
      type: "doc",
      content: [
        heading(1, "Your Name"),
        paragraph("City, State · you@email.com · (555) 555-5555"),
        heading(2, "Summary"),
        paragraph("A one- or two-sentence summary of your experience and goals."),
        heading(2, "Experience"),
        heading(3, "Job Title — Company Name"),
        paragraph("Month Year – Month Year"),
        bulletList([
          "Accomplishment or responsibility, ideally with a measurable result.",
          "Another accomplishment.",
        ]),
        heading(2, "Education"),
        paragraph("Degree, School Name — Year"),
        heading(2, "Skills"),
        bulletList(["Skill one", "Skill two", "Skill three"]),
      ],
    },
  },
  {
    id: "cover-letter",
    name: "Cover Letter",
    description: "A standard business cover letter format.",
    title: "Cover Letter",
    content: {
      type: "doc",
      content: [
        paragraph("Your Name"),
        paragraph("Your Address"),
        paragraph("City, State ZIP"),
        paragraph(),
        paragraph("Date"),
        paragraph(),
        paragraph("Hiring Manager's Name"),
        paragraph("Company Name"),
        paragraph("Company Address"),
        paragraph(),
        paragraph("Dear Hiring Manager,"),
        paragraph(
          "Opening paragraph: state the position you're applying for and a brief hook."
        ),
        paragraph(
          "Middle paragraph(s): connect your experience to what the role needs."
        ),
        paragraph(
          "Closing paragraph: reiterate interest and thank them for their time."
        ),
        paragraph(),
        paragraph("Sincerely,"),
        paragraph("Your Name"),
      ],
    },
  },
  {
    id: "business-letter",
    name: "Business Letter",
    description: "A formal business letter format.",
    title: "Business Letter",
    content: {
      type: "doc",
      content: [
        paragraph("Your Company Name"),
        paragraph("Your Address"),
        paragraph(),
        paragraph("Date"),
        paragraph(),
        paragraph("Recipient Name"),
        paragraph("Recipient Company"),
        paragraph("Recipient Address"),
        paragraph(),
        paragraph("Dear [Recipient],"),
        paragraph("State the purpose of the letter clearly in the first sentence."),
        paragraph("Provide supporting details in the following paragraph(s)."),
        paragraph("Close with a clear next step or call to action."),
        paragraph(),
        paragraph("Regards,"),
        paragraph("Your Name"),
        paragraph("Your Title"),
      ],
    },
  },
  {
    id: "report",
    name: "Report",
    description: "A structured report with common sections.",
    title: "Report Title",
    content: {
      type: "doc",
      content: [
        heading(1, "Report Title"),
        paragraph("Prepared by [Name] · [Date]"),
        heading(2, "Executive Summary"),
        paragraph("A brief overview of the report's purpose and key findings."),
        heading(2, "Background"),
        paragraph("Context and background information."),
        heading(2, "Findings"),
        bulletList(["Finding one.", "Finding two.", "Finding three."]),
        heading(2, "Recommendations"),
        bulletList(["Recommendation one.", "Recommendation two."]),
        heading(2, "Conclusion"),
        paragraph("A closing summary."),
      ],
    },
  },
];
