# Job Market Explorer

A real-time job market analytics dashboard that helps job seekers, career changers, and market researchers explore live job listings, salary data, and industry trends. Built with vanilla JavaScript, Node.js, and the JSearch API.

---

## What It Does

Job Market Explorer transforms raw job market data into actionable insights through three interconnected views. The search experience pulls live listings from Google for Jobs, displaying each result with salary ranges, required skills, company details, and direct apply links. The salary explorer queries Glassdoor estimates for any role and location combination, breaking down base pay versus additional compensation. The analytics dashboard aggregates current listings to surface which skills employers are hiring for, which companies are growing fastest, and what salary ranges look like across the market.

Every piece of data comes from real, current job postings — not static samples or mock data.

---

## API Credits

This application uses the JSearch API by OpenWebNinja to access Google for Jobs data and Glassdoor salary estimates.

- [JSearch API Documentation](https://docs.openwebninja.com/jsearch)
- [OpenWebNinja](https://openwebninja.com)

Job listings, company logos, and salary data are sourced from public job sites including LinkedIn, Indeed, Glassdoor, ZipRecruiter, and company career pages, aggregated through Google for Jobs.

---

## Local Development

### Prerequisites

- Node.js 18 or higher
- A JSearch API key from [OpenWebNinja](https://openwebninja.com)

### Setup

Clone the repository and install dependencies.

```bash
git clone https://github.com/cindoha-hash/Web_infra_summative
cd job-dashboard
npm install

### Video Presentation

video_url:https://www.youtube.com/watch?v=ldmPhS6VkJ4
