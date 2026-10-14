import { useEffect, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, Building, Check, ChevronLeft, ChevronRight, CircleCheck, LoaderCircle, Package, RefreshCw, Search, ShieldAlert, Store, Tag, Users, X } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '/api' : '')).replace(/\/+$/, '')
const PAGE_SIZE = 25
const emptyPage = { items: [], pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, pages: 0 } }
const formatINR = value => `₹${Number(value || 0).toLocaleString('en-IN')}`

async function api(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    },
    signal: options.signal
  })
  const data = response.status === 204 ? null : await response.json()
  if (!response.ok) {
    const error = new Error(response.status === 401
      ? 'Your session has expired. Sign in again to continue.'
      : response.status === 403
        ? 'This account does not have administrator access.'
        : response.status === 404
          ? 'That record no longer exists. Refresh the list and try again.'
          : data?.error || 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return data
}

function useAdminPage(resource, token, query, filters, retry) {
  const [data, setData] = useState(emptyPage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(PAGE_SIZE), ...filters })
  const url = `${resource}?${params}`
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api(url, token, { signal: controller.signal })
      .then(setData)
      .catch(loadError => {
        if (loadError.name !== 'AbortError') setError(loadError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [url, token, retry])
  return { data, loading, error }
}

function SearchFilters({label, query, setQuery, status, setStatus, statusOptions, category, setCategory, categoryOptions, type, setType, typeOptions}) {
  return <form className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={event => { event.preventDefault(); setQuery(event.currentTarget.elements.search.value.trim()) }}>
    <label className="relative sm:col-span-2 xl:col-span-1">
      <span className="sr-only">{label}</span>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden="true"/>
      <input name="search" defaultValue={query} key={`${label}-${query}`} maxLength={120} placeholder={label} className="w-full rounded-xl border border-ink/10 bg-cream/60 py-2.5 pl-9 pr-3 text-sm focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-700/15"/>
    </label>
    {statusOptions&&<label><span className="sr-only">Filter by status</span><select aria-label="Filter by status" value={status} onChange={event=>setStatus(event.target.value)} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"><option value="all">All statuses</option>{statusOptions.map(option=><option value={option.value} key={option.value}>{option.label}</option>)}</select></label>}
    {categoryOptions&&<label><span className="sr-only">Filter by category</span><select aria-label="Filter by category" value={category} onChange={event=>setCategory(event.target.value)} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"><option value="">All categories</option>{categoryOptions.map(option=><option key={option} value={option}>{option}</option>)}</select></label>}
    {typeOptions&&<label><span className="sr-only">Filter by target</span><select aria-label="Filter by target" value={type} onChange={event=>setType(event.target.value)} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"><option value="all">All report targets</option>{typeOptions.map(option=><option key={option} value={option}>{option}</option>)}</select></label>}
    <button className="button-dark min-h-10 justify-center px-4 py-2 text-sm sm:col-span-2 xl:col-span-1" type="submit"><Search size={15}/>Search</button>
  </form>
}

function Pager({pagination, onChange}) {
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/5 pt-4 text-sm text-ink/55">
    <span>{pagination.total ? `Showing ${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}` : 'No results'}</span>
    <div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={pagination.page <= 1} onClick={()=>onChange(pagination.page - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft size={16}/></button><span>Page {pagination.page} of {Math.max(1, pagination.pages)}</span><button type="button" aria-label="Next page" disabled={pagination.page >= pagination.pages} onClick={()=>onChange(pagination.page + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight size={16}/></button></div>
  </div>
}

function TableState({loading,error,empty,retry}) {
  if (loading) return <div role="status" className="flex items-center gap-2 py-10 text-sm text-ink/55"><LoaderCircle size={17} className="animate-spin"/>Loading records…</div>
  if (error) return <div role="alert" className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button type="button" onClick={retry} className="mt-2 inline-flex items-center gap-2 underline"><RefreshCw size={14}/>Retry</button></div>
  if (empty) return <p className="py-10 text-center text-sm text-ink/50">No matching records. Adjust the search or filters.</p>
  return null
}

function ConfirmAction({dialog, busy, close, confirm}) {
  if (!dialog) return null
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/55 p-4" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)close()}}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" className="w-full max-w-md rounded-2xl border border-ink/10 bg-cream p-6 shadow-2xl">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-900"><ShieldAlert size={19}/></span>
      <h2 id="admin-confirm-title" className="mt-4 text-xl font-semibold">{dialog.title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/60">{dialog.message}</p>
      <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} onClick={close} className="button-outline px-4 py-2.5 text-sm">Cancel</button><button type="button" disabled={busy} onClick={confirm} className="button-dark px-4 py-2.5 text-sm disabled:opacity-50">{busy?'Working…':dialog.actionLabel}</button></div>
    </section>
  </div>
}

function BusinessManagement({kind, token, onChanged}) {
  const [page,setPage] = useState(1)
  const [query,setQuery] = useState('')
  const [location,setLocation] = useState('')
  const [category,setCategory] = useState('')
  const [status,setStatus] = useState('all')
  const [retry,setRetry] = useState(0)
  const [action,setAction] = useState(null)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const resource = useAdminPage('/admin/businesses',token,{page},{kind,q:query,location,category,status},retry)
  const businesses = resource.data
  const title = kind === 'shop' ? 'Shop Management' : 'Hotel Management'

  useEffect(()=>setError(resource.error),[resource.error])

  const submitAction = async () => {
    if (!action) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api(`/admin/businesses/${kind}/${encodeURIComponent(action.business.id)}/moderation`,token,{
        method:'PATCH',
        body:JSON.stringify({action:action.action,reason:action.reason})
      })
      const labels = {approve:'approved',reject:'rejected',suspend:'suspended',restore:'restored'}
      setNotice(`${action.business.name} was ${labels[action.action]}.`)
      setAction(null)
      setRetry(value=>value+1)
      onChanged()
    } catch (requestError) {
      setError(requestError.message)
      setAction(null)
    } finally {
      setBusy(false)
    }
  }

  const actionsFor = business => {
    const actions = []
    if (['pending','rejected','legacy'].includes(business.approvalStatus)) actions.push(['approve','Approve'])
    if (['pending','approved','legacy'].includes(business.approvalStatus)) actions.push(['reject','Reject'])
    if (['approved','legacy'].includes(business.approvalStatus)) actions.push(['suspend','Suspend'])
    if (['suspended'].includes(business.approvalStatus)) actions.push(['restore','Restore'])
    return actions
  }

  return <section id={`admin-${kind}-panel`} role="tabpanel" aria-labelledby={`admin-${kind}-tab`} className="mt-7 rounded-2xl border border-ink/8 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-ink/55">Review submissions without deleting business records or inventory.</p></div><button type="button" onClick={()=>setRetry(value=>value+1)} className="button-outline px-3 py-2 text-sm"><RefreshCw size={14}/>Refresh</button></div>
    {notice&&<p role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
    {error&&<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}<button type="button" onClick={()=>setRetry(value=>value+1)} className="ml-2 underline">Retry</button></div>}
    <form className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" onSubmit={event=>{event.preventDefault();setPage(1);setQuery(event.currentTarget.elements.businessSearch.value.trim())}}>
      <label className="sm:col-span-2 xl:col-span-1"><span className="sr-only">Search businesses and owners</span><input name="businessSearch" defaultValue={query} key={`${kind}-q-${query}`} maxLength={120} placeholder="Search business or owner" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/></label>
      <label><span className="sr-only">Filter by location</span><input value={location} onChange={event=>{setPage(1);setLocation(event.target.value)}} maxLength={120} placeholder="Filter location" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/></label>
      <label><span className="sr-only">Filter by category</span><select value={category} onChange={event=>{setPage(1);setCategory(event.target.value)}} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"><option value="">All categories</option>{(businesses.categories||[]).map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label><span className="sr-only">Filter by approval status</span><select value={status} onChange={event=>{setPage(1);setStatus(event.target.value)}} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"><option value="all">All statuses</option>{['pending','approved','rejected','suspended','legacy'].map(value=><option key={value} value={value}>{value==='legacy'?'Legacy records':value}</option>)}</select></label>
      <button className="button-dark min-h-10 justify-center px-4 py-2 text-sm" type="submit"><Search size={15}/>Search</button>
    </form>
    <TableState loading={resource.loading} error={resource.error} empty={!businesses.items.length} retry={()=>setRetry(value=>value+1)}/>
    {!resource.loading&&!resource.error&&businesses.items.length>0&&<div className="mt-5 space-y-3">
      {businesses.items.map(business=><article key={business.id} className="rounded-xl border border-ink/8 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{business.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${business.approvalStatus==='approved'?'bg-green-100 text-green-800':business.approvalStatus==='pending'?'bg-amber-100 text-amber-900':'bg-cream text-ink/70'}`}>{business.approvalStatus==='legacy'?'Legacy · public':business.approvalStatus}</span>{business.verified&&<span className="rounded-full bg-teal/10 px-2 py-1 text-xs font-semibold text-teal">Verified business</span>}</div>
            <p className="mt-1 text-sm text-ink/60">{business.category||'Category not provided'} · {business.location||'Location not provided'}</p>
            <p className="mt-2 text-sm">{business.contactNumber||'No contact provided'}{business.createdAt&&<span className="ml-2 text-xs text-ink/45">Added {new Date(business.createdAt).toLocaleDateString()}</span>}</p>
            <p className="mt-2 text-xs text-ink/55">{business.ownership==='unclaimed'?'Legacy / unclaimed record':`Owner-managed · ${business.ownerName||'Owner name unavailable'}${business.ownerEmail?` · ${business.ownerEmail}`:''}${business.ownerPhone?` · ${business.ownerPhone}`:''}`}</p>
            {business.approvalStatus==='rejected'&&business.moderationReason&&<p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">Review reason: {business.moderationReason}</p>}
            {business.approvalStatus==='suspended'&&business.moderationReason&&<p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Suspension reason: {business.moderationReason}</p>}
          </div>
          <div className="flex flex-wrap gap-2">{actionsFor(business).map(([actionName,label])=><button key={actionName} type="button" onClick={()=>setAction({business,action:actionName,reason:''})} className="button-outline px-3 py-2 text-xs">{label}</button>)}</div>
        </div>
      </article>)}
      <Pager pagination={businesses.pagination} onChange={setPage}/>
    </div>}
    {action&&<div className="fixed inset-0 z-[70] grid place-items-center bg-ink/55 p-4" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setAction(null)}}>
      <section role="alertdialog" aria-modal="true" aria-labelledby={`${kind}-moderation-title`} className="w-full max-w-md rounded-2xl border border-ink/10 bg-cream p-6 shadow-2xl">
        <h3 id={`${kind}-moderation-title`} className="text-xl font-semibold">{action.action[0].toUpperCase()+action.action.slice(1)} {action.business.name}?</h3>
        <p className="mt-2 text-sm leading-6 text-ink/60">{action.action==='reject'?'The business will be hidden from public listings. Its owner can view this reason and correct the submission.':action.action==='suspend'?'The business and its associated shop inventory will be hidden, but no records or products will be deleted.':action.action==='restore'?'This business will be approved and visible publicly again.':'This business will be approved and displayed publicly.'}</p>
        {['reject','suspend'].includes(action.action)&&<label className="mt-4 block text-sm font-medium">Review reason<textarea required minLength={5} maxLength={500} value={action.reason} onChange={event=>setAction(current=>({...current,reason:event.target.value}))} className="mt-1 min-h-24 w-full rounded-xl border border-ink/10 bg-white p-3 text-sm" placeholder="Explain the decision (5–500 characters)"/></label>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} onClick={()=>setAction(null)} className="button-outline px-4 py-2.5 text-sm">Cancel</button><button type="button" disabled={busy||(['reject','suspend'].includes(action.action)&&action.reason.trim().length<5)} onClick={submitAction} className="button-dark px-4 py-2.5 text-sm disabled:opacity-50">{busy?'Saving…':`Confirm ${action.action}`}</button></div>
      </section>
    </div>}
  </section>
}

export default function AdminDashboard({user,categoryData,setCategoryData}) {
  const token = localStorage.getItem('campuskart-token') || ''
  const [stats,setStats] = useState(null)
  const [overviewLoading,setOverviewLoading] = useState(true)
  const [overviewError,setOverviewError] = useState('')
  const [overviewRetry,setOverviewRetry] = useState(0)
  const [usersPage,setUsersPage] = useState(1)
  const [usersQuery,setUsersQuery] = useState('')
  const [usersStatus,setUsersStatus] = useState('all')
  const [usersRetry,setUsersRetry] = useState(0)
  const [listingPage,setListingPage] = useState(1)
  const [listingQuery,setListingQuery] = useState('')
  const [listingStatus,setListingStatus] = useState('all')
  const [listingCategory,setListingCategory] = useState('')
  const [listingRetry,setListingRetry] = useState(0)
  const [reportPage,setReportPage] = useState(1)
  const [reportQuery,setReportQuery] = useState('')
  const [reportStatus,setReportStatus] = useState('all')
  const [reportType,setReportType] = useState('all')
  const [reportRetry,setReportRetry] = useState(0)
  const [usersError,setUsersError] = useState('')
  const [listingError,setListingError] = useState('')
  const [reportError,setReportError] = useState('')
  const [categoriesError,setCategoriesError] = useState('')
  const [actionError,setActionError] = useState('')
  const [busy,setBusy] = useState(false)
  const [dialog,setDialog] = useState(null)
  const [categoryDraft,setCategoryDraft] = useState({name:'',icon:'Package'})
  const [editingCategory,setEditingCategory] = useState('')
  const [categoryBusy,setCategoryBusy] = useState(false)
  const [categoryRetry,setCategoryRetry] = useState(0)
  const [businessTab,setBusinessTab] = useState('shop')
  const usersResult = useAdminPage('/users',token,{page:usersPage},{q:usersQuery,status:usersStatus},usersRetry)
  const listingsResult = useAdminPage('/products/moderation/all',token,{page:listingPage},{q:listingQuery,status:listingStatus,category:listingCategory},listingRetry)
  const reportsResult = useAdminPage('/reports',token,{page:reportPage},{q:reportQuery,status:reportStatus,targetType:reportType},reportRetry)
  const users = usersResult.data
  const listings = listingsResult.data
  const reports = reportsResult.data
  const categories = categoryData || []
  const activeCategories = categories.filter(item=>item.active).sort((a,b)=>a.order-b.order)

  useEffect(()=>{
    const controller = new AbortController()
    setOverviewLoading(true)
    setOverviewError('')
    setStats(null)
    Promise.all([
      api('/admin/stats',token,{signal:controller.signal}),
      api('/categories/admin',token,{signal:controller.signal})
    ]).then(([overview,categoryRecords])=>{
      setStats(overview)
      setCategoryData(current=>categoryRecords.map(record=>({
        ...record,
        iconName:record.icon,
        color:current.find(item=>item.name===record.name)?.color||'bg-mint text-teal'
      })))
      setCategoriesError('')
    }).catch(error=>{
      if(error.name!=='AbortError')setOverviewError(error.message)
    }).finally(()=>{if(!controller.signal.aborted)setOverviewLoading(false)})
    return ()=>controller.abort()
  },[token,user?.id,overviewRetry,categoryRetry,setCategoryData])

  useEffect(()=>setUsersError(usersResult.error),[usersResult.error])
  useEffect(()=>setListingError(listingsResult.error),[listingsResult.error])
  useEffect(()=>setReportError(reportsResult.error),[reportsResult.error])

  const reloadStats = () => setOverviewRetry(value=>value+1)
  const runAction = async action => {
    setBusy(true)
    setActionError('')
    try {
      await action()
      setDialog(null)
      reloadStats()
      setUsersRetry(value=>value+1)
      setListingRetry(value=>value+1)
      setReportRetry(value=>value+1)
      setCategoryRetry(value=>value+1)
    } catch (error) {
      setActionError(error.message)
      setDialog(null)
    } finally { setBusy(false) }
  }

  const changeUserStatus = (account,status) => setDialog({
    title:`${status==='active'?'Restore':'Change'} ${account.name}'s access?`,
    message:account.role==='admin'&&status!=='active'
      ?'This administrator will only be suspended if another active administrator remains.'
      :`This account will be set to ${status}.`,
    actionLabel:`Set ${status}`,
    action:()=>api(`/users/${encodeURIComponent(account.id)}/status`,token,{method:'PATCH',body:JSON.stringify({status})})
  })
  const updateListing = (listing,status) => setDialog({
    title:status==='Rejected'?'Reject this listing?':'Restore this listing?',
    message:status==='Rejected'
      ?'The listing will be hidden from the public marketplace. It remains in the database and can be restored.'
      :'The listing will be visible in the marketplace again.',
    actionLabel:status==='Rejected'?'Reject listing':'Restore listing',
    action:()=>api(`/products/${encodeURIComponent(listing.id)}`,token,{method:'PUT',body:JSON.stringify({status})})
  })
  const resolveReport = (report,status) => runAction(()=>api(`/reports/${encodeURIComponent(report.id)}`,token,{method:'PATCH',body:JSON.stringify({status})}))
  const toggleFeatured = listing => runAction(()=>api(`/products/${encodeURIComponent(listing.id)}`,token,{method:'PUT',body:JSON.stringify({featured:!listing.featured})}))

  const saveCategory = async (id,updates) => {
    setCategoryBusy(true);setCategoriesError('')
    try {
      await api(`/categories/${encodeURIComponent(id)}`,token,{method:'PUT',body:JSON.stringify(updates)})
      setEditingCategory('')
      setCategoryRetry(value=>value+1)
      reloadStats()
    } catch(error) { setCategoriesError(error.message) }
    finally { setCategoryBusy(false) }
  }
  const createCategory = async event => {
    event.preventDefault()
    setCategoryBusy(true);setCategoriesError('')
    try {
      await api('/categories',token,{method:'POST',body:JSON.stringify(categoryDraft)})
      setCategoryDraft({name:'',icon:'Package'})
      setCategoryRetry(value=>value+1)
      reloadStats()
    } catch(error) { setCategoriesError(error.message) }
    finally { setCategoryBusy(false) }
  }
  const reorderCategories = async (category,direction) => {
    const ordered=[...categories].filter(item=>item.active).sort((a,b)=>a.order-b.order)
    const index=ordered.findIndex(item=>item._id===category._id)
    const target=index+direction
    if(index<0||target<0||target>=ordered.length)return
    ;[ordered[index],ordered[target]]=[ordered[target],ordered[index]]
    setCategoryBusy(true);setCategoriesError('')
    try {
      await api('/categories/reorder',token,{method:'PUT',body:JSON.stringify({ids:ordered.map(item=>item._id)})})
      setCategoryRetry(value=>value+1)
    } catch(error) { setCategoriesError(error.message) }
    finally { setCategoryBusy(false) }
  }
  const changeCategoryState = category => setDialog({
    title:category.active?'Deactivate this category?':'Reactivate this category?',
    message:category.active
      ?'Existing listings will remain unchanged, but sellers can no longer use this category for new listings.'
      :'This category will become available for new listings again.',
    actionLabel:category.active?'Deactivate':'Reactivate',
    action:()=>api(`/categories/${encodeURIComponent(category._id)}`,token,{method:'PUT',body:JSON.stringify({active:!category.active})})
  })

  const categoriesErrorText=categoriesError||overviewError
  const retryAll=()=>{
    reloadStats()
    setUsersRetry(value=>value+1);setListingRetry(value=>value+1);setReportRetry(value=>value+1);setCategoryRetry(value=>value+1)
  }

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-6">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-teal">Marketplace operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Admin dashboard</h1><p className="mt-2 text-sm text-ink/55">Moderate marketplace activity and manage community records.</p></div>
      <button type="button" onClick={retryAll} className="button-outline min-h-10 px-4 py-2 text-sm"><RefreshCw size={15}/>Refresh data</button>
    </header>
    {actionError&&<div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertCircle size={18} className="mt-0.5 shrink-0"/><div className="flex-1">{actionError}</div><button type="button" aria-label="Dismiss error" onClick={()=>setActionError('')}><X size={16}/></button></div>}
    {overviewLoading&&<p role="status" className="mt-5 text-sm text-ink/55">Loading marketplace statistics…</p>}
    {overviewError&&<div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{overviewError}<button type="button" onClick={retryAll} className="ml-2 underline">Retry</button></div>}
    <section aria-label="Marketplace statistics" className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {[
        [Users,'Users',stats?.users],
        [Package,'Listings',stats?.listings],
        [CircleCheck,'Active',stats?.activeListings],
        [Check,'Sold',stats?.soldListings],
        [Store,'Shops',stats?.shops],
        [Store,'Hotels',stats?.hotels],
        [ShieldAlert,'Pending reports',stats?.pendingReports],
        [Tag,'Categories',stats?.categories]
      ].map(([Icon,label,value])=><article key={label} className="rounded-xl border border-ink/8 bg-white p-4 shadow-sm"><Icon size={17} className="text-amber-800"/><p className="mt-3 text-xs text-ink/55">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value??<span className="text-ink/35">—</span>}</p></article>)}
    </section>

    <section className="mt-8" aria-label="Business management">
      <div role="tablist" aria-label="Business management type" className="flex flex-wrap gap-2">
        <button id="admin-shop-tab" type="button" role="tab" aria-selected={businessTab==='shop'} aria-controls="admin-shop-panel" onClick={()=>setBusinessTab('shop')} className={`${businessTab==='shop'?'button-dark':'button-outline'} px-4 py-2.5 text-sm`}><Store size={16}/>Shop Management</button>
        <button id="admin-hotel-tab" type="button" role="tab" aria-selected={businessTab==='hotel'} aria-controls="admin-hotel-panel" onClick={()=>setBusinessTab('hotel')} className={`${businessTab==='hotel'?'button-dark':'button-outline'} px-4 py-2.5 text-sm`}><Building size={16}/>Hotel Management</button>
      </div>
      <div hidden={businessTab!=='shop'}><BusinessManagement kind="shop" token={token} onChanged={reloadStats}/></div>
      <div hidden={businessTab!=='hotel'}><BusinessManagement kind="hotel" token={token} onChanged={reloadStats}/></div>
    </section>

    <section className="mt-8 rounded-2xl border border-ink/8 bg-white p-4 shadow-sm sm:p-6">
      <div><h2 className="text-xl font-semibold">Reports</h2><p className="mt-1 text-sm text-ink/55">Review reports and update their resolution state.</p></div>
      <SearchFilters label="Search report text" query={reportQuery} setQuery={value=>{setReportPage(1);setReportQuery(value)}} status={reportStatus} setStatus={value=>{setReportPage(1);setReportStatus(value)}} statusOptions={['Pending','Reviewing','Resolved','Rejected'].map(value=>({value,label:value}))} type={reportType} setType={value=>{setReportPage(1);setReportType(value)}} typeOptions={['listing','seller','message']}/>
      <TableState loading={reports.loading} error={reportError} empty={!reports.items.length} retry={()=>setReportRetry(value=>value+1)}/>
      {!reports.loading&&!reportError&&reports.items.length>0&&<><div className="mt-5 space-y-3">{reports.items.map(report=><article key={report.id} className="rounded-xl border border-ink/8 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-cream px-2.5 py-1 font-semibold">{report.targetType}</span><span className="rounded-full bg-cream px-2.5 py-1">{report.status}</span></div><h3 className="mt-2 font-semibold">{report.targetName}</h3><p className="mt-1 text-sm text-ink/65">{report.reason}{report.details&&` · ${report.details}`}</p><time className="mt-2 block text-xs text-ink/40">{new Date(report.createdAt).toLocaleString()}</time></div><div className="flex flex-wrap gap-2">{['Pending','Reviewing','Resolved','Rejected'].filter(status=>status!==report.status).map(status=><button type="button" key={status} disabled={busy} onClick={()=>resolveReport(report,status)} className="button-outline px-3 py-2 text-xs disabled:opacity-50">{status}</button>)}</div></div></article>)}</div><Pager pagination={reports.pagination} onChange={setReportPage}/></>}
    </section>

    <section className="mt-7 rounded-2xl border border-ink/8 bg-white p-4 shadow-sm sm:p-6">
      <div><h2 className="text-xl font-semibold">Listings</h2><p className="mt-1 text-sm text-ink/55">Search, filter and moderate listings. Rejection is reversible.</p></div>
      <SearchFilters label="Search product, seller or location" query={listingQuery} setQuery={value=>{setListingPage(1);setListingQuery(value)}} status={listingStatus} setStatus={value=>{setListingPage(1);setListingStatus(value)}} statusOptions={[{value:'Active',label:'Active'},{value:'Sold',label:'Sold'},{value:'Rejected',label:'Rejected'}]} category={listingCategory} setCategory={value=>{setListingPage(1);setListingCategory(value)}} categoryOptions={[...new Set(categories.map(item=>item.name))]}/>
      <TableState loading={listings.loading} error={listingError} empty={!listings.items.length} retry={()=>setListingRetry(value=>value+1)}/>
      {!listings.loading&&!listingError&&listings.items.length>0&&<><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-cream/80 text-xs uppercase tracking-wide text-ink/50"><tr><th className="p-3">Listing</th><th className="p-3">Seller</th><th className="p-3">Price</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{listings.items.map(listing=><tr key={listing.id} className="border-t border-ink/5"><td className="p-3 font-medium">{listing.title}</td><td className="p-3">{listing.seller||'Seller unavailable'}</td><td className="p-3 tabular-nums">{formatINR(listing.price)}</td><td className="p-3">{listing.category}</td><td className="p-3">{listing.status||'Active'}{listing.featured&&<span className="ml-2 text-xs text-amber-800">Featured</span>}</td><td className="p-3"><div className="flex gap-2">{listing.status==='Rejected'?<button type="button" disabled={busy} onClick={()=>updateListing(listing,'Active')} className="button-outline px-3 py-2 text-xs">Restore</button>:<button type="button" disabled={busy} onClick={()=>updateListing(listing,'Rejected')} className="button-outline px-3 py-2 text-xs">Reject</button>}<button type="button" disabled={busy} onClick={()=>toggleFeatured(listing)} className="button-outline px-3 py-2 text-xs">{listing.featured?'Unfeature':'Feature'}</button></div></td></tr>)}</tbody></table></div><Pager pagination={listings.pagination} onChange={setListingPage}/></>}
    </section>

    <section className="mt-7 rounded-2xl border border-ink/8 bg-white p-4 shadow-sm sm:p-6">
      <div><h2 className="text-xl font-semibold">Users</h2><p className="mt-1 text-sm text-ink/55">Search accounts and suspend or restore access. Administrators cannot disable themselves or the last active administrator.</p></div>
      <SearchFilters label="Search name, email, phone or location" query={usersQuery} setQuery={value=>{setUsersPage(1);setUsersQuery(value)}} status={usersStatus} setStatus={value=>{setUsersPage(1);setUsersStatus(value)}} statusOptions={['active','suspended','banned'].map(value=>({value,label:value}))}/>
      <TableState loading={users.loading} error={usersError} empty={!users.items.length} retry={()=>setUsersRetry(value=>value+1)}/>
      {!users.loading&&!usersError&&users.items.length>0&&<><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-cream/80 text-xs uppercase tracking-wide text-ink/50"><tr><th className="p-3">Name</th><th className="p-3">Email / phone</th><th className="p-3">Location</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Change access</th></tr></thead><tbody>{users.items.map(account=><tr key={account.id} className="border-t border-ink/5"><td className="p-3 font-medium">{account.name}</td><td className="p-3">{account.email||account.phone||'Not supplied'}</td><td className="p-3">{account.location||'Not supplied'}</td><td className="p-3">{account.role}</td><td className="p-3">{account.status}</td><td className="p-3"><select aria-label={`Change status for ${account.name}`} value={account.status} disabled={busy||account.id===user?.id} onChange={event=>changeUserStatus(account,event.target.value)} className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs disabled:opacity-50"><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option></select></td></tr>)}</tbody></table></div><Pager pagination={users.pagination} onChange={setUsersPage}/></>}
    </section>

    <section className="mt-7 rounded-2xl border border-ink/8 bg-white p-4 shadow-sm sm:p-6">
      <div><h2 className="text-xl font-semibold">Categories</h2><p className="mt-1 text-sm text-ink/55">Deactivation keeps existing listings intact. At least one active category must remain.</p></div>
      <form onSubmit={createCategory} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]"><label className="sr-only" htmlFor="admin-new-category">New category name</label><input id="admin-new-category" required maxLength={80} value={categoryDraft.name} onChange={event=>setCategoryDraft(current=>({...current,name:event.target.value}))} placeholder="New category name" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/><label className="sr-only" htmlFor="admin-category-icon">Icon name</label><input id="admin-category-icon" maxLength={40} value={categoryDraft.icon} onChange={event=>setCategoryDraft(current=>({...current,icon:event.target.value}))} className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/><button disabled={categoryBusy} className="button-dark justify-center px-4 py-2.5 text-sm disabled:opacity-50">Add category</button></form>
      {categoriesErrorText&&<div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{categoriesErrorText}<button type="button" onClick={()=>setCategoryRetry(value=>value+1)} className="ml-2 underline">Retry</button></div>}
      <div className="mt-4 divide-y divide-ink/5">{categories.map(category=><article key={category._id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1">{editingCategory===category._id?<div className="grid gap-2 sm:grid-cols-2"><input aria-label="Category name" value={categoryDraft.name} onChange={event=>setCategoryDraft(current=>({...current,name:event.target.value}))} maxLength={80} className="rounded-lg border px-3 py-2 text-sm"/><input aria-label="Category icon name" value={categoryDraft.icon} onChange={event=>setCategoryDraft(current=>({...current,icon:event.target.value}))} maxLength={40} className="rounded-lg border px-3 py-2 text-sm"/></div>:<><p className="font-medium">{category.name}</p><p className="text-xs text-ink/45">{category.active?'Active':'Inactive'} · {category.icon}</p></>}</div><div className="flex flex-wrap gap-2">{editingCategory===category._id?<><button type="button" onClick={()=>saveCategory(category._id,categoryDraft)} disabled={categoryBusy} className="button-dark px-3 py-2 text-xs">Save</button><button type="button" onClick={()=>setEditingCategory('')} className="button-outline px-3 py-2 text-xs">Cancel</button></>:<><button type="button" aria-label={`Move ${category.name} up`} onClick={()=>reorderCategories(category,-1)} disabled={categoryBusy||!category.active||activeCategories.findIndex(item=>item._id===category._id)===0} className="rounded-lg border p-2 disabled:opacity-40"><ArrowUp size={14}/></button><button type="button" aria-label={`Move ${category.name} down`} onClick={()=>reorderCategories(category,1)} disabled={categoryBusy||!category.active||activeCategories.findIndex(item=>item._id===category._id)>=activeCategories.length-1} className="rounded-lg border p-2 disabled:opacity-40"><ArrowDown size={14}/></button><button type="button" onClick={()=>{setEditingCategory(category._id);setCategoryDraft({name:category.name,icon:category.icon||'Package'})}} className="button-outline px-3 py-2 text-xs">Edit</button><button type="button" onClick={()=>changeCategoryState(category)} disabled={categoryBusy||category.active&&activeCategories.length<=1} className="button-outline px-3 py-2 text-xs disabled:opacity-40">{category.active?'Deactivate':'Reactivate'}</button></>}</div></article>)}</div>
      {categoriesError&&<button type="button" onClick={()=>setCategoryRetry(value=>value+1)} className="mt-2 inline-flex items-center gap-2 text-sm underline"><RefreshCw size={14}/>Retry categories</button>}
    </section>
    <ConfirmAction dialog={dialog} busy={busy} close={()=>setDialog(null)} confirm={()=>runAction(dialog.action)}/>
  </div>
}
