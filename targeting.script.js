// https://www.notion.so/schroeder-weische/Split-test-targeting-snippets-7457f5a0d97a424991fce143fc27a187
return (async conditions=>{
    let wait = 20;
    while (wait--) {
        let c = await Promise.allSettled(conditions.map(async f=>f())).catch(()=>{}) || [];
        if (c.filter(({value})=>!!value).length===conditions.length) return !0;
        await new Promise(r=>setTimeout(r,150));
    }
    throw new Error();
})([
    ()=>{return /* PROVIDE YOUR BOOLEAN CONDITION TO CHECK HERE */},
    ()=>{return /* PROVIDE YOUR BOOLEAN CONDITION TO CHECK HERE */},
])
