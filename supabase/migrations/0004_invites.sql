-- =====================================================================
-- Household invite flow. Invitees are not yet members, so they can't read
-- the invite or household under RLS. These SECURITY DEFINER functions let an
-- authenticated user preview and accept an invite by its secret token.
-- =====================================================================

-- Preview an invite by token (safe for non-members): returns the household
-- name, the role being offered, and a status string.
create or replace function public.invite_details(p_token text)
returns table (household_name text, role public.member_role, status text)
language plpgsql security definer stable as $$
declare
  v_inv public.household_invites;
  v_name text;
begin
  select * into v_inv from public.household_invites where token = p_token;
  if not found then
    return query select null::text, null::public.member_role, 'invalid';
    return;
  end if;

  select name into v_name from public.households where id = v_inv.household_id;

  if v_inv.accepted_at is not null then
    return query select v_name, v_inv.role, 'accepted';
  elsif v_inv.expires_at < now() then
    return query select v_name, v_inv.role, 'expired';
  else
    return query select v_name, v_inv.role, 'valid';
  end if;
end; $$;
grant execute on function public.invite_details(text) to anon, authenticated;

-- Accept an invite: adds the caller to the household with the invite's role
-- and marks the invite accepted. Returns the household id.
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_inv public.household_invites;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_inv from public.household_invites where token = p_token;
  if not found then
    raise exception 'invalid invite';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'invite expired';
  end if;

  insert into public.household_members (household_id, user_id, role)
    values (v_inv.household_id, v_user, v_inv.role)
    on conflict (household_id, user_id) do nothing;

  update public.household_invites
    set accepted_at = coalesce(accepted_at, now())
    where id = v_inv.id;

  return v_inv.household_id;
end; $$;
grant execute on function public.accept_invite(text) to authenticated;
