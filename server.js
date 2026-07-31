require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const axiosLib = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const path = require('path');

// Force IPv4
const axios = axiosLib.create({
  httpAgent: new http.Agent({ family: 4 }),
  httpsAgent: new https.Agent({ family: 4 }),
  timeout: 15000
});

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(helmet());
app.use(express.json());
app.use(express.static('public'));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Startup validation
console.log('🔑 Checking API credentials...');
console.log('JSEARCH_API_KEY exists:', !!process.env.JSEARCH_API_KEY);
if (process.env.JSEARCH_API_KEY) {
  console.log('JSEARCH_API_KEY:', process.env.JSEARCH_API_KEY.substring(0, 8) + '...');
}

// Rate limiter – 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// In-memory cache (15 min TTL)
const cache = new NodeCache({ stdTTL: 900, checkperiod: 600 });

// ==============================================
//  Helper Functions
// ==============================================
function extractSkills(job) {
  const skills = [
    'JavaScript', 'Python', 'React', 'Node.js', 'AWS', 'SQL', 'TypeScript',
    'Java', 'Docker', 'Machine Learning', 'Data Analysis', 'Agile', 'CSS',
    'HTML', 'Git', 'REST API', 'GraphQL', 'MongoDB', 'PostgreSQL', 'DevOps',
    'CI/CD', 'Kubernetes', 'Linux', 'Angular', 'Vue.js', 'PHP', 'Ruby',
    'Swift', 'Kotlin', 'Go', 'Rust', 'C#', '.NET', 'Azure', 'GCP'
  ];
  
  const description = (job.job_description || '').toLowerCase();
  const highlights = job.job_highlights || {};
  const qualifications = (highlights.Qualifications || []).join(' ').toLowerCase();
  const responsibilities = (highlights.Responsibilities || []).join(' ').toLowerCase();
  const allText = description + ' ' + qualifications + ' ' + responsibilities;
  
  return skills.filter(s => allText.includes(s.toLowerCase()));
}

function formatJob(job) {
  return {
    id: job.job_id,
    title: job.job_title || 'Untitled Position',
    company: job.employer_name || 'Confidential',
    logo: job.employer_logo || null,
    location: job.job_location || `${job.job_city || ''}, ${job.job_country || 'Remote'}`,
    salary: job.job_min_salary 
      ? `$${job.job_min_salary.toLocaleString()} – $${(job.job_max_salary || 0).toLocaleString()}`
      : 'Not disclosed',
    type: job.job_employment_type || 'Full-time',
    remote: job.work_arrangement === 'remote' || job.job_is_remote || false,
    url: job.job_apply_link || job.job_google_link || '#',
    posted: job.job_posted_at || 'Recent',
    postedDate: job.job_posted_at_datetime_utc 
      ? new Date(job.job_posted_at_datetime_utc).toLocaleDateString() 
      : 'Recent',
    category: job.job_function || 'Technology',
    snippet: (job.job_description || '').substring(0, 200) + '...',
    skills: extractSkills(job),
    benefits: job.job_benefits || [],
    highlights: job.job_highlights || {},
    employerReviews: job.employer_reviews || [],
    seniority: job.seniority_level || null,
    requiredExperience: job.required_experience_years || null
  };
}

// ==============================================
//  API Endpoint 1: Job Search
// ==============================================
app.get('/api/jobs/search', async (req, res) => {
  try {
    const { 
      q = 'software developer', 
      loc = 'us', 
      page = 1, 
      remote,
      employment_types,
      date_posted = 'month'
    } = req.query;
    
    console.log(`🔍 Job search: q="${q}", loc="${loc}", page=${page}, remote=${remote}`);

    // Validate API key
    if (!process.env.JSEARCH_API_KEY) {
      console.error('❌ Missing JSEARCH_API_KEY in .env');
      return res.status(500).json({ error: 'Server configuration error - missing API key.' });
    }

    // Cache key
    const cacheKey = `search_${q}_${loc}_${page}_${remote}_${employment_types}_${date_posted}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('💾 Returning cached result');
      return res.json({ ...cached, cached: true });
    }

    // Build query string with location
    const countryMap = {
      'us': 'United States',
      'gb': 'United Kingdom', 
      'ca': 'Canada',
      'de': 'Germany',
      'fr': 'France',
      'au': 'Australia'
    };
    const countryName = countryMap[loc] || 'United States';
    const searchQuery = remote === 'true' 
      ? `${q} remote in ${countryName}`
      : `${q} in ${countryName}`;

    // Build params according to JSearch API spec
    const params = {
      query: searchQuery,
      page: page,
      num_pages: 1,
      country: loc,
      date_posted: date_posted || 'month'
    };

    // Add optional filters
    if (remote === 'true') {
      params.work_from_home = true;
    }
    if (employment_types) {
      params.employment_types = employment_types;
    }

    console.log('📡 Calling JSearch API...');
    console.log('📦 Query:', searchQuery);
    console.log('📦 Params:', { ...params });

    const response = await axios.get('https://api.openwebninja.com/jsearch/search-v2', {
      params: params,
      headers: {
        'x-api-key': process.env.JSEARCH_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ JSearch response status:', response.data.status);
    console.log('✅ Jobs found:', response.data.data?.jobs?.length || 0);

    const jobs = (response.data.data?.jobs || []).map(formatJob);
    const result = {
      jobs,
      total: jobs.length,
      page: parseInt(page),
      pages: 1, // JSearch uses cursor-based pagination
      cursor: response.data.data?.cursor || null
    };

    cache.set(cacheKey, result);
    console.log('💾 Cached result. Total jobs:', result.total);
    res.json(result);

  } catch (err) {
    console.error('❌ === JOB SEARCH ERROR ===');
    console.error('Message:', err.message);

    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data).substring(0, 500));

      if (err.response.status === 429) {
        return res.status(429).json({ 
          error: 'API rate limit reached. Please try again in a few minutes.' 
        });
      }
      if (err.response.status === 401 || err.response.status === 403) {
        return res.status(500).json({ 
          error: 'Invalid API key. Please check server configuration.' 
        });
      }
    } else {
      console.error('Error code:', err.code);
    }
    console.error('=========================');
    
    res.status(502).json({ 
      error: 'Unable to fetch job listings. Please try again later.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==============================================
//  API Endpoint 2: Job Details
// ==============================================
app.get('/api/jobs/details/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`📋 Job details request: ${jobId}`);

    if (!process.env.JSEARCH_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const response = await axios.get('https://api.openwebninja.com/jsearch/job-details', {
      params: {
        job_id: jobId,
        country: 'us'
      },
      headers: {
        'x-api-key': process.env.JSEARCH_API_KEY
      }
    });

    const jobDetails = response.data.data?.[0];
    if (!jobDetails) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    res.json({
      job: formatJob(jobDetails),
      fullDescription: jobDetails.job_description,
      applyOptions: jobDetails.apply_options || [],
      salaryPeriod: jobDetails.job_salary_period,
      requiredTechnologies: jobDetails.required_technologies || [],
      preferredTechnologies: jobDetails.preferred_technologies || [],
      methodologies: jobDetails.methodologies || [],
      benefitsExtended: jobDetails.benefits_extended || [],
      softSkills: jobDetails.soft_skills || []
    });

  } catch (err) {
    console.error('❌ Job details error:', err.message);
    res.status(502).json({ error: 'Unable to fetch job details.' });
  }
});

// ==============================================
//  API Endpoint 3: Salary Estimation
// ==============================================
app.get('/api/jobs/salary', async (req, res) => {
  try {
    const { job_title, location = 'new york' } = req.query;
    console.log(`💰 Salary request: ${job_title} in ${location}`);

    if (!job_title) {
      return res.status(400).json({ error: 'job_title parameter is required.' });
    }
    if (!process.env.JSEARCH_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const cacheKey = `salary_${job_title}_${location}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('💾 Returning cached salary');
      return res.json({ ...cached, cached: true });
    }

    const response = await axios.get('https://api.openwebninja.com/jsearch/estimated-salary', {
      params: {
        job_title: job_title,
        location: location,
        location_type: 'ANY'
      },
      headers: {
        'x-api-key': process.env.JSEARCH_API_KEY
      }
    });

    const salaryData = response.data.data || [];
    const result = {
      salaries: salaryData.map(s => ({
        location: s.location,
        jobTitle: s.job_title,
        medianSalary: s.median_salary,
        salaryRange: {
          min: s.min_salary,
          max: s.max_salary
        },
        baseSalary: {
          min: s.min_base_salary,
          max: s.max_base_salary,
          median: s.median_base_salary
        },
        additionalPay: {
          min: s.min_additional_pay,
          max: s.max_additional_pay,
          median: s.median_additional_pay
        },
        period: s.salary_period,
        currency: s.salary_currency,
        confidence: s.confidence,
        sampleSize: s.salary_count,
        publisher: s.publisher_name
      }))
    };

    cache.set(cacheKey, result, 3600); // Cache for 1 hour
    res.json(result);

  } catch (err) {
    console.error('❌ Salary error:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
    }
    res.status(502).json({ error: 'Unable to fetch salary data.' });
  }
});
// ==============================================
//  API Endpoint 4: Market Analytics (Aggregated)
// ==============================================
app.get('/api/jobs/analytics', async (req, res) => {
  try {
    console.log('📊 Analytics request received');
    
    const cacheKey = 'market_analytics';
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('💾 Returning cached analytics');
      return res.json({ ...cached, cached: true });
    }

    if (!process.env.JSEARCH_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    // Fetch just 1 page with more results to reduce API calls
    console.log('📡 Fetching analytics sample...');
    
    // Use a shorter timeout for this request
    const axiosShort = axiosLib.create({
      httpAgent: new http.Agent({ family: 4 }),
      httpsAgent: new https.Agent({ family: 4 }),
      timeout: 20000 // 20 seconds
    });

    const response = await axiosShort.get('https://api.openwebninja.com/jsearch/search-v2', {
      params: {
        query: 'software developer in United States',
        page: 1,
        num_pages: 1, // Reduced from 3 to 1
        country: 'us',
        date_posted: 'month'
      },
      headers: {
        'x-api-key': process.env.JSEARCH_API_KEY
      }
    });

    const jobs = (response.data.data?.jobs || []).map(formatJob);
    console.log(`✅ Analytics: ${jobs.length} jobs analyzed`);

    // Compute skill demand
    const skillCounts = {};
    jobs.forEach(job => {
      job.skills.forEach(skill => {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      });
    });
    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([skill, count]) => ({ skill, count }));

    // Employment types distribution
    const employmentTypes = {};
    jobs.forEach(job => {
      const type = job.type || 'Other';
      employmentTypes[type] = (employmentTypes[type] || 0) + 1;
    });

    // Remote vs On-site
    const remoteCount = jobs.filter(j => j.remote).length;

    // Salary analysis
    const salaryRegex = /\$([\d,]+)\s*[–-]\s*\$([\d,]+)/;
    const salaries = jobs
      .map(j => {
        const match = j.salary.match(salaryRegex);
        if (match) {
          const min = parseInt(match[1].replace(/,/g, ''));
          const max = parseInt(match[2].replace(/,/g, ''));
          return (min + max) / 2;
        }
        return null;
      })
      .filter(s => s !== null);
    
    const avgSalary = salaries.length 
      ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length) 
      : 0;

    // Seniority distribution
    const seniorityCounts = {};
    jobs.forEach(job => {
      const level = job.seniority || 'Not Specified';
      seniorityCounts[level] = (seniorityCounts[level] || 0) + 1;
    });

    // Company distribution (top companies)
    const companyCounts = {};
    jobs.forEach(job => {
      if (job.company && job.company !== 'Confidential') {
        companyCounts[job.company] = (companyCounts[job.company] || 0) + 1;
      }
    });
    const topCompanies = Object.entries(companyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([company, count]) => ({ company, count }));

    const analytics = {
      totalJobsAnalyzed: jobs.length,
      topSkills,
      avgSalary,
      salarySampleSize: salaries.length,
      remotePercentage: jobs.length > 0 ? Math.round((remoteCount / jobs.length) * 100) : 0,
      employmentTypes,
      seniorityDistribution: seniorityCounts,
      topCompanies,
      sampleDate: new Date().toISOString()
    };

    cache.set(cacheKey, analytics, 1800); // 30 minutes
    console.log('📈 Analytics complete. Avg salary:', avgSalary);
    res.json(analytics);

  } catch (err) {
    console.error('❌ === ANALYTICS ERROR ===');
    console.error('Message:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data).substring(0, 300));
    } else if (err.code === 'ECONNABORTED') {
      console.error('Request timed out');
    } else {
      console.error('Error code:', err.code);
    }
    console.error('=========================');
    res.status(502).json({ error: 'Market data temporarily unavailable.' });
  }
});

// Health check for load balancer
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Catch-all: serve frontend for any other route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log('📋 API Endpoints:');
  console.log(`   🔍 Search:     /api/jobs/search?q=developer&loc=us`);
  console.log(`   📋 Details:    /api/jobs/details/:jobId`);
  console.log(`   💰 Salary:     /api/jobs/salary?job_title=developer&location=new york`);
  console.log(`   📊 Analytics:  /api/jobs/analytics`);
  console.log(`   💚 Health:     /health\n`);
});
