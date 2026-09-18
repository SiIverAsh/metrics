//Setup
export default async function({login, q, imports, data, account}, {enabled = false, token, extras = false} = {}) {
  //Plugin execution
  try {
    //Check if plugin is enabled and requirements are met
    if ((!q.wakatime) || (!imports.metadata.plugins.wakatime.enabled(enabled, {extras})))
      return null

    //Load inputs
    let {sections, days, limit, url, user, "languages.other": others, "languages.ignored": _ignored, "repositories.visibility": repositoriesVisibility} = imports.metadata.plugins.wakatime.inputs({data, account, q})

    if (!limit)
      limit = void limit

    const showOnlyGitHubPublicRepos = repositoriesVisibility === "public"

    const range = {
      "7": "last_7_days",
      "30": "last_30_days",
      "180": "last_6_months",
      "365": "last_year",
    }[days] ?? "last_7_days"
    console.debug(`metrics/compute/${login}/plugins > wakatime > range: ${range}`)

    //Querying api and format result (https://wakatime.com/developers#stats)
    console.debug(`metrics/compute/${login}/plugins > wakatime > querying api`)
    const {data: {data: stats}} = await imports.axios.get(`${url}/api/v1/users/${user}/stats/${range}?api_key=${token}`)
    const languageColors = sections.some(section => section.startsWith("languages"))
      ? await getLanguageColors({axios: imports.axios, url, login})
      : {}

    const projectStats = stats.projects?.map(({name, percent, total_seconds: total}) => ({name, percent: percent / 100, total})).sort((a, b) => b.percent - a.percent)
    const projects = showOnlyGitHubPublicRepos ? await pickOnlyGitHubPublicRepos({limit, login, axios: imports.axios, projects: projectStats}) : projectStats?.slice(0, limit)
    const bestDay = stats.best_day
      ? {date: formatDate(stats.best_day.date), duration: stats.best_day.text}
      : null
    const mainCategory = stats.categories
      ?.map(({name, percent, total_seconds: total}) => ({name, percent: percent / 100, total}))
      .sort((a, b) => b.percent - a.percent)[0]

    const result = {
      sections,
      days,
      period: ({7: "7-day statistics", 30: "30-day statistics", 180: "6-month statistics", 365: "1-year statistics"})[days] ?? `${days}-day statistics`,
      bestDay,
      mainCategory,
      projects,
      time: {
        total: (others ? stats.total_seconds_including_other_language : stats.total_seconds) / (60 * 60),
        daily: (others ? stats.daily_average_including_other_language : stats.daily_average) / (60 * 60),
      },
      languages: stats.languages?.map(({name, percent, total_seconds: total}) => ({name, percent: percent / 100, total, color: languageColors[name] ?? "#8b949e"})).filter(({name}) => imports.filters.text(name, _ignored)).sort((a, b) => b.percent - a.percent).slice(0, limit),
      os: stats.operating_systems?.map(({name, percent, total_seconds: total}) => ({name, percent: percent / 100, total})).sort((a, b) => b.percent - a.percent).slice(0, limit),
      editors: stats.editors?.map(({name, percent, total_seconds: total}) => ({name, percent: percent / 100, total})).sort((a, b) => b.percent - a.percent).slice(0, limit),
    }

    //Result
    return result
  }
  //Handle errors
  catch (error) {
    throw imports.format.error(error)
  }
}

function formatDate(date) {
  const [, month, day] = date?.match(/^(?:\d{4})-(\d{2})-(\d{2})$/) ?? []
  if ((!month) || (!day))
    return date
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1]} ${Number(day)}`
}

async function getLanguageColors({axios, url, login}) {
  try {
    console.debug(`metrics/compute/${login}/plugins > wakatime > querying language colors`)
    const {data: {data: languages}} = await axios.get(`${url}/api/v1/program_languages?per_page=1000`)
    return Object.fromEntries(languages.map(({name, color}) => [name, color]).filter(([, color]) => color))
  }
  catch (error) {
    console.debug(`metrics/compute/${login}/plugins > wakatime > failed to query language colors (${error})`)
    return {}
  }
}

async function pickOnlyGitHubPublicRepos({projects, axios, login, limit}) {
  const result = []

  for await (const project of projects ?? []) {
    if (result.length >= limit)
      break
    try {
      console.debug(`metrics/compute/${login}/plugins > wakatime > checking 'https://github.com/${login}/${project.name}'`)
      await axios.head(`https://github.com/${login}/${project.name}`)

      result.push(project)
    }
    catch {
      continue
    }
  }

  if (result.length === 0)
    return undefined
  return result
}
