const commands = [
  {
    name: "inventory",
    description: "View your claimed cards",
  },
  {
    name: "card",
    description: "View a specific card by your inventory ID",
    options: [
      {
        name: "id",
        description: "Your inventory ID number (example: 1)",
        type: 4, // INTEGER
        required: true,
      },
    ],
  },
];
