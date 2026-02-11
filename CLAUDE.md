# Multi-Expert Discussion

## Overview
This project provides a multi-expert discussion system powered by Claude Code subagents.
When given a topic or challenge, the facilitator agent automatically selects relevant expert agents,
runs them in parallel, and synthesizes their perspectives into actionable conclusions.

## Usage
1. Use the `facilitator` agent with any topic: the facilitator will select 3-5 relevant experts from 12 available specialists
2. Or invoke individual expert agents directly for a single-perspective analysis

## Available Agents

### Orchestrator
- `facilitator` - Selects experts, runs parallel discussions, cross-analyzes, and synthesizes conclusions

### Expert Agents (12 roles)
- `expert-tech-lead` - Software architecture, code quality, technical strategy
- `expert-agile-coach` - Agile methodology, processes, continuous improvement
- `expert-devops` - CI/CD, infrastructure, automation, platforms
- `expert-em` - Team management, hiring, organizational design
- `expert-product-manager` - Product strategy, user value, roadmap
- `expert-ux-designer` - User experience, design thinking, usability
- `expert-qa-engineer` - Quality assurance, testing strategy, reliability
- `expert-security-engineer` - Security, compliance, risk management
- `expert-data-analyst` - Data-driven decisions, metrics, analytics
- `expert-business-strategist` - Business model, market strategy, growth
- `expert-hr-specialist` - People management, culture, talent development
- `expert-marketing-specialist` - Growth marketing, branding, communication

## Language
All agents respond in the same language as the user's input.
